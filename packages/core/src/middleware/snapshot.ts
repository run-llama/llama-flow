import {
  type Workflow,
  type WorkflowContext,
  type WorkflowEvent,
  workflowEvent,
} from "@llama-flow/core";
import { isPromiseLike } from "../core/utils";
import type { InferWorkflowEvent } from "../core/event";

/**
 * Suspense event is a special event
 *  used to indicate that the workflow is in a suspended state.
 *
 * You will need to handle it outside the context
 *  and put the result back into the context.
 */
export const suspense = workflowEvent<WorkflowEvent<any>, "suspense">({
  debugLabel: "suspense",
});

type SuspenseContext = WorkflowContext & {
  snapshot: () => Promise<Uint8Array>;
};

type SuspenseWorkflow = Workflow & {
  recoverContext(): SuspenseContext;
};

export const withSnapshot = (workflow: Workflow): SuspenseWorkflow => {
  return {
    ...workflow,
    createContext(): SuspenseContext {
      const context = workflow.createContext();
      const pendingTask = new Set<PromiseLike<any>>();
      const collectedSuspense = new Set<InferWorkflowEvent<typeof suspense>>();
      let lock = false;
      context.__internal__call_send_event.subscribe(() => {
        if (lock) {
          throw new Error("Cannot send event after snapshot");
        }
      });
      context.__internal__call_context.subscribe((context, next) => {
        const originalHandler = context.handler;
        context.handler = (...events) => {
          const result = originalHandler(...events);
          if (isPromiseLike(result)) {
            pendingTask.add(result);
            result.then((event) => {
              if (suspense.include(event)) {
                collectedSuspense.add(event);
              }
              pendingTask.delete(result);
            });
          } else if (suspense.include(result)) {
            collectedSuspense.add(result);
          }
          return result;
        };
        next(context);
      });
      return {
        ...context,
        snapshot: async () => {
          lock = true;
          return null!;
        },
      };
    },
    recoverContext() {
      return null!;
    },
  };
};
