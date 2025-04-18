import { type WorkflowEvent, type WorkflowEventData } from "./event";
import { createContext, type Handler, type WorkflowContext } from "./_context";

export type Workflow<Mis extends [] = [], Mos extends [] = []> = {
  handle<
    const AcceptEvents extends WorkflowEvent<any>[],
    Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
  >(
    accept: AcceptEvents,
    handler: Handler<AcceptEvents, Result>,
  ): void;
  createContext(): Mutate<WorkflowContext, Mis>;
  $$workflowMutators?: Mos;
};

type Mutate<S, Ms> = number extends Ms["length" & keyof Ms]
  ? S
  : Ms extends []
    ? S
    : Ms extends [[infer Mi, infer Ma], ...infer Mrs]
      ? Mutate<WorkflowMutators<S, Ma>[Mi & WorkflowMutatorIdentifier], Mrs>
      : never;

export interface WorkflowMutators<S, A> {}
export type WorkflowMutatorIdentifier = keyof WorkflowMutators<
  unknown,
  unknown
>;

export type WorkflowCreator<
  Mis extends [] = [],
  Mos extends [] = [],
> = () => Workflow<Mis, Mos>;

export const createWorkflow: WorkflowCreator = (): Workflow => {
  const config = {
    steps: new Map<
      WorkflowEvent<any>[],
      Set<Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>>
    >(),
  };

  return {
    handle: <
      const AcceptEvents extends WorkflowEvent<any>[],
      Result extends ReturnType<WorkflowEvent<any>["with"]> | void,
    >(
      accept: AcceptEvents,
      handler: Handler<AcceptEvents, Result>,
    ): void => {
      if (config.steps.has(accept)) {
        const set = config.steps.get(accept) as Set<
          Handler<AcceptEvents, Result>
        >;
        set.add(handler);
      } else {
        const set = new Set<Handler<AcceptEvents, Result>>();
        set.add(handler);
        config.steps.set(
          accept,
          set as Set<
            Handler<WorkflowEvent<any>[], WorkflowEventData<any> | void>
          >,
        );
      }
    },
    createContext() {
      return createContext({
        listeners: config.steps,
      });
    },
  };
};
