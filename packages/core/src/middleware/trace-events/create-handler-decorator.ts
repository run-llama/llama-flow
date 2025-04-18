import type {
  Handler,
  WorkflowEvent,
  WorkflowEventData,
} from "@llama-flow/core";
import type { HandlerContext } from "@llama-flow/core";

const namespace = "decorator" as const;

let counter = 0;

export const decoratorRegistry = new Map<
  string,
  {
    handlers: WeakSet<
      Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>
    >;
    debugLabel: string;
    getInitialValue: () => any;
    onBeforeHandler: (
      handler: Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>,
      handlerContext: Readonly<HandlerContext>,
      metadata: any,
    ) => Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>;
    onAfterHandler: (metadata: any) => any;
  }
>();

export function createHandlerDecorator<Metadata>(config: {
  debugLabel?: string;
  getInitialValue: () => Metadata;
  onBeforeHandler: (
    handler: Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>,
    handlerContext: HandlerContext,
    metadata: Metadata,
  ) => Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>;
  onAfterHandler: (metadata: Metadata) => Metadata;
}) {
  const uid = `${namespace}:${counter++}`;
  decoratorRegistry.set(uid, {
    handlers: new WeakSet(),
    debugLabel: config.debugLabel ?? uid,
    getInitialValue: config.getInitialValue,
    onAfterHandler: config.onAfterHandler,
    onBeforeHandler: config.onBeforeHandler,
  });
  return function <
    const AcceptEvents extends WorkflowEvent<any>[],
    Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
    Fn extends Handler<AcceptEvents, Result>,
  >(handler: Fn) {
    decoratorRegistry
      .get(uid)!
      .handlers.add(
        handler as Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>,
      );
    return handler;
  };
}
