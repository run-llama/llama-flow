import * as babelParser from "@babel/parser";
import { type Expression, type Node } from "@babel/types";
import type { Handler } from "@llama-flow/core";
import type { AcceptEventsType, ResultType } from "./types";

// Helper function to parse handler code and traverse AST
function _parseAndExtractFromHandlerAst<
  T,
  C,
  AcceptEvents extends AcceptEventsType,
  Result extends ResultType,
>(
  handler: Handler<AcceptEvents, Result>,
  initialContext: C,
  visitorFunc: (node: Node, context: C) => void,
  resultSelector: (context: C) => T | undefined,
  emptyResultMessage: string,
  defaultValue: T,
): T {
  try {
    const handlerCode = handler.toString();
    const ast = babelParser.parse(handlerCode, {
      sourceType: "module",
    });

    const context = initialContext;

    const visit = (node: Node) => {
      if (!node) {
        return;
      }
      visitorFunc(node, context);

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

    const result = resultSelector(context);

    if (
      result !== undefined &&
      (!(Array.isArray(result) && result.length === 0) ||
        (Array.isArray(result) && result.length > 0))
    ) {
      // Check if result is not undefined, and if it's an array, it's not empty.
      // For non-array types, or non-empty arrays, return the result.
      if (
        Array.isArray(result) &&
        result.length === 0 &&
        defaultValue !== undefined &&
        Array.isArray(defaultValue) &&
        defaultValue.length === 0
      ) {
        // If result is an empty array and defaultValue is also an empty array, log and return empty array.
        console.log(emptyResultMessage);
        return defaultValue;
      }
      return result;
    } else {
      console.log(emptyResultMessage);
      return defaultValue;
    }
  } catch (e: any) {
    console.error("Error parsing handler code with Babel:", e.message);
    return defaultValue;
  }
}

export function getReturnedEventName<
  AcceptEvents extends AcceptEventsType,
  Result extends ResultType,
>(handler: Handler<AcceptEvents, Result>): string | undefined {
  return _parseAndExtractFromHandlerAst<
    string | undefined,
    { returnedEventName: string | null },
    AcceptEvents,
    Result
  >(
    handler,
    { returnedEventName: null },
    (node, context) => {
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
            context.returnedEventName = returnArgNode.name;
          } else if (
            returnArgNode.type === "CallExpression" &&
            returnArgNode.callee.type === "MemberExpression" &&
            returnArgNode.callee.object.type === "Identifier"
          ) {
            context.returnedEventName = (
              returnArgNode.callee.object as any
            ).name;
          }
        }
      }
    },
    (context) => context.returnedEventName ?? undefined,
    "Parser did not identify a clear returned event variable from handler AST.",
    undefined,
  );
}

export function getSentEventNames<
  AcceptEvents extends AcceptEventsType,
  Result extends ResultType,
>(handler: Handler<AcceptEvents, Result>): string[] {
  return _parseAndExtractFromHandlerAst<
    string[],
    { sentEventNames: Set<string> },
    AcceptEvents,
    Result
  >(
    handler,
    { sentEventNames: new Set<string>() },
    (node, context) => {
      if (node.type === "CallExpression") {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "sendEvent"
        ) {
          if (node.arguments.length > 0) {
            const firstArg = node.arguments[0];
            if (firstArg && firstArg.type === "Identifier") {
              context.sentEventNames.add(firstArg.name);
            } else if (
              firstArg &&
              firstArg.type === "CallExpression" &&
              firstArg.callee.type === "MemberExpression" &&
              firstArg.callee.object.type === "Identifier"
            ) {
              context.sentEventNames.add((firstArg.callee.object as any).name);
            }
          }
        }
      }
    },
    (context) => Array.from(context.sentEventNames),
    "Parser did not identify any calls to sendEvent with identifiable event names.",
    [],
  );
}

export function getAwaitedEventNames<
  AcceptEvents extends AcceptEventsType,
  Result extends ResultType,
>(handler: Handler<AcceptEvents, Result>): string[] {
  return _parseAndExtractFromHandlerAst<
    string[],
    { awaitedEventNames: Set<string> },
    AcceptEvents,
    Result
  >(
    handler,
    { awaitedEventNames: new Set<string>() },
    (node, context) => {
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
              context.awaitedEventNames.add(firstArg.name);
            }
          }
        }
      }
    },
    (context) => Array.from(context.awaitedEventNames),
    "Parser did not identify any calls to stream.filter() with identifiable event names.",
    [],
  );
}
