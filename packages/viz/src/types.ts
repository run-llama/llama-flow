import type { WorkflowEvent } from "@llama-flow/core";

export type AcceptEventsType = WorkflowEvent<any>[];
export type ResultType = ReturnType<WorkflowEvent<any>["with"]> | void;
