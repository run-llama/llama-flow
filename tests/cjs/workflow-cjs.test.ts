// Pure CommonJS Vitest test file with TypeScript
import type { WorkflowEvent, Workflow } from "@llama-flow/core";

// Type the require imports properly for TypeScript
const llamaFlow = require("@llama-flow/core") as {
  createWorkflow: () => Workflow;
  workflowEvent: <T = any>() => WorkflowEvent<T>;
};
const stateLlama = require("@llama-flow/core/middleware/state") as {
  createStatefulMiddleware: (input: CallableFunction) => {
    withState: (workflow: Workflow) => Workflow;
  };
};

const { createStatefulMiddleware } = stateLlama;
const { createWorkflow, workflowEvent } = llamaFlow;

interface JokeResult {
  joke: string;
}

describe("Llama Flow Pure CJS Tests", () => {
  describe("Basic CJS Import Tests", () => {
    test("should import core functions via require", () => {
      expect(createWorkflow).toBeDefined();
      expect(workflowEvent).toBeDefined();
      expect(typeof createWorkflow).toBe("function");
      expect(typeof workflowEvent).toBe("function");
    });

    test("should create workflow events", () => {
      const event = workflowEvent<string>();
      expect(event).toBeDefined();
      expect(typeof event.with).toBe("function");
      expect(typeof event.include).toBe("function");
    });
  });

  describe("Workflow Functionality", () => {
    let startEvent: WorkflowEvent<string>;
    let resultEvent: WorkflowEvent<JokeResult>;
    let jokeFlow: Workflow;
    let numIterations: number;

    beforeEach(() => {
      // Reset state before each test
      numIterations = 0;

      // Define our workflow events
      startEvent = workflowEvent<string>(); // Input topic for joke
      resultEvent = workflowEvent<JokeResult>(); // Final joke

      const { withState } = createStatefulMiddleware(() => ({}));

      // Create our workflow
      jokeFlow = withState(createWorkflow());

      // Define handlers for each step
      jokeFlow.handle([startEvent], async (event: any) => {
        // Increment our manual state counter
        numIterations++;

        const joke = `Here is a wonderful joke about ${event.data} (iteration ${numIterations})`;

        return resultEvent.with({ joke: joke });
      });
    });

    test("should create and execute a basic workflow", async () => {
      const { stream, sendEvent } = jokeFlow.createContext();

      sendEvent(startEvent.with("pirates"));

      let result: JokeResult | undefined;
      for await (const event of stream) {
        if (resultEvent.include(event)) {
          result = event.data;
          break;
        }
      }

      expect(result).toBeDefined();
      expect(result!.joke).toContain("pirates");
      expect(result!.joke).toContain("iteration 1");
      expect(numIterations).toBe(1);
    });

    test("should handle multiple workflow executions", async () => {
      // First execution
      const { stream: stream1, sendEvent: sendEvent1 } =
        jokeFlow.createContext();
      sendEvent1(startEvent.with("cats"));

      let result1: JokeResult | undefined;
      for await (const event of stream1) {
        if (resultEvent.include(event)) {
          result1 = event.data;
          break;
        }
      }

      // Second execution
      const { stream: stream2, sendEvent: sendEvent2 } =
        jokeFlow.createContext();
      sendEvent2(startEvent.with("dogs"));

      let result2: JokeResult | undefined;
      for await (const event of stream2) {
        if (resultEvent.include(event)) {
          result2 = event.data;
          break;
        }
      }

      expect(result1!.joke).toContain("cats");
      expect(result1!.joke).toContain("iteration 1");
      expect(result2!.joke).toContain("dogs");
      expect(result2!.joke).toContain("iteration 2");
      expect(numIterations).toBe(2);
    });

    test("should work with different data types", async () => {
      const numberEvent = workflowEvent<number>();
      const doubleEvent = workflowEvent<number>();

      const mathFlow = createWorkflow();
      mathFlow.handle([numberEvent], (event) => {
        return doubleEvent.with(event.data * 2);
      });

      const { stream, sendEvent } = mathFlow.createContext();
      sendEvent(numberEvent.with(21));

      let result: number | undefined;
      for await (const event of stream) {
        if (doubleEvent.include(event)) {
          result = event.data;
          break;
        }
      }

      expect(result).toBe(42);
    });

    test("should not throw 'No current context found' errors", async () => {
      // This test specifically verifies the original error is avoided
      const { stream, sendEvent } = jokeFlow.createContext();

      // This should not throw the context error
      await expect(async () => {
        sendEvent(startEvent.with("test"));

        for await (const event of stream) {
          if (resultEvent.include(event)) {
            break;
          }
        }
      }).not.toThrow();
    });

    test("should handle async workflows correctly", async () => {
      const asyncEvent = workflowEvent<string>();
      const asyncResultEvent = workflowEvent<string>();

      const asyncFlow = createWorkflow();
      asyncFlow.handle([asyncEvent], async (event) => {
        // Simulate async work
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
        return asyncResultEvent.with(`Async result: ${event.data}`);
      });

      const { stream, sendEvent } = asyncFlow.createContext();
      sendEvent(asyncEvent.with("async test"));

      let result: string | undefined;
      for await (const event of stream) {
        if (asyncResultEvent.include(event)) {
          result = event.data;
          break;
        }
      }

      expect(result).toBe("Async result: async test");
    });

    test("should demonstrate the original user code pattern", async () => {
      // This replicates the user's original pattern but working in CJS
      const { stream, sendEvent } = jokeFlow.createContext();
      sendEvent(startEvent.with("pirates"));

      let result: JokeResult | undefined;

      for await (const event of stream) {
        // console.log(event.data);  // optionally log the event data
        if (resultEvent.include(event)) {
          result = event.data;
          break; // Stop when we get the final result
        }
      }

      expect(result).toBeDefined();
      expect(result!.joke).toContain("pirates");

      // Verify this works without throwing context errors
      console.log("✅ Original user pattern works in CJS:", result);
    });

    test("should have proper TypeScript typing", () => {
      // Test that TypeScript types work correctly
      const stringEvent = workflowEvent<string>();
      const numberEvent = workflowEvent<number>();
      const customEvent = workflowEvent<{ id: number; name: string }>();

      // These should be properly typed
      const stringData = stringEvent.with("test");
      const numberData = numberEvent.with(42);
      const customData = customEvent.with({ id: 1, name: "test" });

      expect(stringData.data).toBe("test");
      expect(numberData.data).toBe(42);
      expect(customData.data).toEqual({ id: 1, name: "test" });

      // Type checking - these would fail at compile time if types are wrong
      expect(typeof stringData.data).toBe("string");
      expect(typeof numberData.data).toBe("number");
      expect(typeof customData.data).toBe("object");
    });
  });
});
