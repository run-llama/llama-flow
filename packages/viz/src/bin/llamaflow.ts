import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createServer } from "vite";
import * as babelParser from "@babel/parser";
import { type Node, type Expression } from "@babel/types";

const app = new Hono();

interface WorkflowAnalysis {
  filePath: string;
  workflowName: string;
  handlers: {
    acceptedEvents: string[];
    returnedEvent: string | undefined;
    sentEvents: string[];
    awaitedEvents: string[];
  }[];
}

// Global map to track workflows across files
const globalWorkflowMap = new Map<string, WorkflowAnalysis>();

function extractReturnedEventName(node: Node): string | undefined {
  let returnedEventName: string | undefined;

  const visit = (node: Node) => {
    if (
      node.type === "ExpressionStatement" &&
      node.expression.type === "ArrowFunctionExpression"
    ) {
      const funcExpr = node.expression;
      let returnArgNode: Expression | null = null;

      if (funcExpr.body.type === "BlockStatement") {
        for (const stmt of funcExpr.body.body) {
          if (stmt.type === "ReturnStatement" && stmt.argument) {
            returnArgNode = stmt.argument;
            break;
          }
        }
      } else {
        returnArgNode = funcExpr.body;
      }

      if (returnArgNode) {
        if (returnArgNode.type === "Identifier") {
          returnedEventName = returnArgNode.name;
        } else if (
          returnArgNode.type === "CallExpression" &&
          returnArgNode.callee.type === "MemberExpression" &&
          returnArgNode.callee.object.type === "Identifier"
        ) {
          returnedEventName = returnArgNode.callee.object.name;
        }
      }
    }

    // Recursively visit child nodes
    for (const key in node) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        const child = (node as any)[key];
        if (typeof child === "object" && child !== null) {
          if (Array.isArray(child)) {
            child.forEach(visit);
          } else {
            visit(child);
          }
        }
      }
    }
  };

  visit(node);
  return returnedEventName;
}

function extractSentEventNames(node: Node): string[] {
  const sentEventNames = new Set<string>();

  const visit = (node: Node) => {
    if (node.type === "CallExpression") {
      if (
        node.callee.type === "Identifier" &&
        node.callee.name === "sendEvent"
      ) {
        if (node.arguments.length > 0) {
          const firstArg = node.arguments[0];
          if (firstArg && firstArg.type === "Identifier") {
            sentEventNames.add(firstArg.name);
          } else if (
            firstArg &&
            firstArg.type === "CallExpression" &&
            firstArg.callee.type === "MemberExpression" &&
            firstArg.callee.object.type === "Identifier"
          ) {
            sentEventNames.add(firstArg.callee.object.name);
          }
        }
      }
    }

    // Recursively visit child nodes
    for (const key in node) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        const child = (node as any)[key];
        if (typeof child === "object" && child !== null) {
          if (Array.isArray(child)) {
            child.forEach(visit);
          } else {
            visit(child);
          }
        }
      }
    }
  };

  visit(node);
  return Array.from(sentEventNames);
}

function extractAwaitedEventNames(node: Node): string[] {
  const awaitedEventNames = new Set<string>();

  const visit = (node: Node) => {
    if (node.type === "CallExpression") {
      if (
        node.callee.type === "MemberExpression" &&
        node.callee.object.type === "Identifier" &&
        node.callee.object.name === "stream" &&
        node.callee.property.type === "Identifier" &&
        node.callee.property.name === "filter"
      ) {
        if (node.arguments.length > 0) {
          const firstArg = node.arguments[0];
          if (firstArg && firstArg.type === "Identifier") {
            awaitedEventNames.add(firstArg.name);
          }
        }
      }
    }

    // Recursively visit child nodes
    for (const key in node) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        const child = (node as any)[key];
        if (typeof child === "object" && child !== null) {
          if (Array.isArray(child)) {
            child.forEach(visit);
          } else {
            visit(child);
          }
        }
      }
    }
  };

  visit(node);
  return Array.from(awaitedEventNames);
}

function analyzeFile(code: string, filePath: string): WorkflowAnalysis[] {
  const ast = babelParser.parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
    allowImportExportEverywhere: true,
  });

  const workflows: WorkflowAnalysis[] = [];

  const visit = (node: Node) => {
    // Look for withGraph(createWorkflow()) pattern
    if (
      node.type === "VariableDeclaration" &&
      node.declarations.length > 0 &&
      node.declarations[0]!.init?.type === "CallExpression" &&
      node.declarations[0]!.init.callee.type === "Identifier" &&
      node.declarations[0]!.init.callee.name === "withGraph"
    ) {
      const workflowName =
        node.declarations[0]!.id.type === "Identifier"
          ? node.declarations[0]!.id.name
          : "anonymous";

      // Check if workflow already exists in global map
      const existingWorkflow = globalWorkflowMap.get(workflowName);
      const workflow: WorkflowAnalysis = existingWorkflow || {
        filePath,
        workflowName,
        handlers: [],
      };

      // Find all workflow.handle calls after this workflow definition
      const findHandlers = (node: Node) => {
        if (
          node.type === "ExpressionStatement" &&
          node.expression?.type === "CallExpression" &&
          node.expression.callee?.type === "MemberExpression" &&
          node.expression.callee.object?.type === "Identifier" &&
          node.expression.callee.object.name === workflowName &&
          node.expression.callee.property?.type === "Identifier" &&
          node.expression.callee.property.name === "handle" &&
          node.expression.arguments[0]?.type === "ArrayExpression" &&
          node.expression.arguments[1]?.type === "ArrowFunctionExpression"
        ) {
          const handler = node.expression.arguments[1];
          const acceptedEvents = node.expression.arguments[0].elements
            .filter((el): el is any => el?.type === "Identifier")
            .map((el) => el.name);

          workflow.handlers.push({
            acceptedEvents,
            returnedEvent: extractReturnedEventName(handler),
            sentEvents: extractSentEventNames(handler),
            awaitedEvents: extractAwaitedEventNames(handler),
          });
        }

        // Recursively visit child nodes
        for (const key in node) {
          if (Object.prototype.hasOwnProperty.call(node, key)) {
            const child = (node as any)[key];
            if (typeof child === "object" && child !== null) {
              if (Array.isArray(child)) {
                child.forEach(findHandlers);
              } else {
                findHandlers(child);
              }
            }
          }
        }
      };

      // Start searching from the program root
      findHandlers(ast);

      // Update global map
      globalWorkflowMap.set(workflowName, workflow);
      workflows.push(workflow);
    }

    // Recursively visit child nodes
    for (const key in node) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        const child = (node as any)[key];
        if (typeof child === "object" && child !== null) {
          if (Array.isArray(child)) {
            child.forEach(visit);
          } else {
            visit(child);
          }
        }
      }
    }
  };

  visit(ast);
  return workflows;
}

yargs(hideBin(process.argv))
  .command(
    "serve [file]",
    "Run a LlamaFlow file",
    (yargs) => {
      yargs.positional("file", {
        type: "string",
        describe: "The file to run",
      });
    },
    async (argv) => {
      const { file } = argv;
      if (!file || typeof file !== "string") {
        console.error("No file specified");
        return;
      }
      const workflowAnalysis = new Map<string, WorkflowAnalysis[]>();
      const viteServer = await createServer({
        server: { middlewareMode: true, watch: null },
        appType: "custom",
        environments: {
          config: {
            resolve: { external: ["@llama-flow/viz"] },
          },
        },
        plugins: [
          {
            name: "llamaflow-analyzer",
            transform(code, id) {
              if (id.endsWith(".ts") || id.endsWith(".js")) {
                const workflows = analyzeFile(code, id);
                workflowAnalysis.set(id, workflows);
                return {
                  code,
                  map: null,
                };
              }
            },
          },
        ],
      });

      const mod = await viteServer.environments.ssr.fetchModule(file);

      app.get("/debug", async (c) => {
        return c.render(
          `
        <h1>LlamaFlow Workflow Analysis</h1>
        <pre>${JSON.stringify(mod, null, 2)}</pre>
        <h2>Workflows</h2>
        <pre>${JSON.stringify([...workflowAnalysis], null, 2)}</pre>
        <h2>Global Workflow Map</h2>
        <pre>${JSON.stringify([...globalWorkflowMap], null, 2)}</pre>
        `,
        );
      });

      serve(
        {
          fetch: app.fetch,
          port: 8123,
        },
        (addressInfo) => {
          console.log(`Server running at http://localhost:${addressInfo.port}`);
        },
      );
    },
  )
  .parse();
