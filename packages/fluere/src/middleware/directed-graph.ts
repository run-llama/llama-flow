import {
  type WorkflowContext,
  getContext,
  type Handler,
  type HandlerRef,
  type Workflow,
  type WorkflowEvent,
  type WorkflowEventData,
} from "fluere";

export type DirectedGraphHandler<
  DirectedGraph extends [
    inputs: WorkflowEvent<any>[],
    output: WorkflowEvent<any>[],
  ][],
  AcceptEvents extends WorkflowEvent<any>[],
  Result extends WorkflowEventData<any> | void,
> = (
  sendEvent: (
    ...inputs: Array<
      DirectedGraph[number] extends infer Tuple
        ? Tuple extends [AcceptEvents, infer Outputs]
          ? Outputs extends WorkflowEvent<any>[]
            ? ReturnType<Outputs[number]["with"]>
            : never
          : never
        : never
    >
  ) => void,
  ...events: {
    [K in keyof AcceptEvents]: ReturnType<AcceptEvents[K]["with"]>;
  }
) => Result | Promise<Result>;

export type WithDirectedGraphWorkflow<
  DirectedGraph extends [
    inputs: WorkflowEvent<any>[],
    output: WorkflowEvent<any>[],
  ][],
> = {
  handle<
    const AcceptEvents extends WorkflowEvent<any>[],
    Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
  >(
    accept: AcceptEvents,
    handler: DirectedGraphHandler<DirectedGraph, AcceptEvents, Result>,
  ): HandlerRef<AcceptEvents, Result>;
  createContext(): WorkflowContext;
};

export function directedGraph<
  const DirectedGraph extends [
    inputs: WorkflowEvent<any>[],
    outputs: WorkflowEvent<any>[],
  ][],
>(
  workflow: Workflow,
  directedGraph: DirectedGraph,
): WithDirectedGraphWorkflow<DirectedGraph> {
  const createSafeSendEvent = (...events: WorkflowEventData<any>[]) => {
    const outputs = directedGraph
      .filter(([inputs]) =>
        inputs.every((input, idx) => input.include(events[idx])),
      )
      .map(([_, outputs]) => outputs);
    const store = getContext();
    const originalSendEvent = store.sendEvent;
    return (...inputs: WorkflowEventData<any>[]) => {
      let matched = false;
      for (let i = 0; i < outputs.length; i++) {
        const output = outputs[i]!;
        if (output.length === inputs.length) {
          if (output.every((e, idx) => e.include(inputs[idx]))) {
            matched = true;
            break;
          }
        }
      }
      if (matched) {
        console.warn(
          "Invalid input detected [%s]",
          inputs.map((i) => i.data).join(", "),
        );
      }
      return originalSendEvent(...inputs);
    };
  };
  return {
    ...workflow,
    handle: (accept, handler) => {
      const wrappedHandler: Handler<WorkflowEvent<any>[], any> = (
        ...events
      ) => {
        const context = getContext();
        return handler(
          (context as any).safeSendEvent,
          // @ts-expect-error
          ...events,
        );
      };
      return workflow.handle(accept, wrappedHandler);
    },
    createContext(): WorkflowContext {
      const context = workflow.createContext();
      context.__internal__call_context.add((context, inputs, next) => {
        (context as any).safeSendEvent = createSafeSendEvent(...inputs);
        next();
      });
      return context;
    },
  };
}
