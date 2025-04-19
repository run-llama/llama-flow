declare const opaqueSymbol: unique symbol;

const eventMap = new WeakMap<WorkflowEvent<any>, WeakSet<object>>();
const refMap = new WeakMap<WorkflowEventData<any>, WorkflowEvent<any>>();
let i = 0;
let j = 0;

export type InferWorkflowEventData<T> =
  T extends WorkflowEventData<infer U>
    ? U
    : T extends WorkflowEvent<infer U>
      ? U
      : never;

export type InferWorkflowEvent<Event> =
  Event extends WorkflowEvent<infer Data, infer DebugLabel>
    ? WorkflowEventData<Data, DebugLabel>
    : never;

export type WorkflowEventData<Data, DebugLabel extends string = string> = {
  get data(): Data;
} & { readonly [opaqueSymbol]: DebugLabel };

export type WorkflowEvent<Data, DebugLabel extends string = string> = {
  debugLabel?: DebugLabel;
  with(data: Data): WorkflowEventData<Data, DebugLabel>;
  include(event: unknown): event is WorkflowEventData<Data, DebugLabel>;
} & { readonly [opaqueSymbol]: DebugLabel };

export type WorkflowEventConfig<DebugLabel extends string = string> = {
  debugLabel?: DebugLabel;
};

export const workflowEvent = <Data = void, DebugLabel extends string = string>(
  config?: WorkflowEventConfig<DebugLabel>,
): WorkflowEvent<Data, DebugLabel> => {
  const l1 = `${i++}`;
  const event = {
    debugLabel: config?.debugLabel ?? l1,
    include: (
      instance: WorkflowEventData<any>,
    ): instance is WorkflowEventData<Data> => s.has(instance),
    with: (data: Data) => {
      const l2 = `${j++}`;
      const ref = {
        [Symbol.toStringTag]:
          config?.debugLabel ?? `WorkflowEvent(${l1}.${l2})`,
        toString: () =>
          config?.debugLabel
            ? `${config.debugLabel}(${l2})`
            : `WorkflowEvent(${l1}.${l2})`,
        toJSON: () => {
          return {
            event: l1,
            data,
          };
        },
        get data() {
          return data;
        },
      } as unknown as WorkflowEventData<Data, DebugLabel>;
      s.add(ref);
      refMap.set(ref, event);
      return ref;
    },
  } as unknown as WorkflowEvent<Data, DebugLabel>;

  const s = new WeakSet();
  eventMap.set(event, s);

  Object.defineProperty(event, Symbol.toStringTag, {
    get: () => event?.debugLabel ?? `WorkflowEvent<${l1}>`,
  });

  Object.defineProperty(event, "displayName", {
    value: event?.debugLabel ?? `WorkflowEvent<${l1}>`,
  });

  event.toString = () => config?.debugLabel ?? `WorkflowEvent<${l1}>`;
  return event;
};

// utils
export const eventSource = (
  instance: unknown,
): WorkflowEvent<any> | undefined =>
  typeof instance === "object" && instance !== null
    ? refMap.get(instance as any)
    : undefined;
