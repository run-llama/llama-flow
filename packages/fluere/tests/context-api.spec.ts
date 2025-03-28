import { describe, expect, test, vi } from "vitest";
import {
  createWorkflow,
  eventSource,
  getContext,
  readableStream,
  workflowEvent,
  type WorkflowEventData,
} from "fluere";

describe.skip("workflow context api", () => {
  const startEvent = workflowEvent({
    debugLabel: "startEvent",
  });
  const stopEvent = workflowEvent({
    debugLabel: "stopEvent",
  });

  test("should work in loop", async () => {
    const startEvent = workflowEvent<string>({
      debugLabel: "startEvent",
    });
    const stopEvent = workflowEvent<1 | -1>({
      debugLabel: "stopEvent",
    });
    const workflow = createWorkflow<string, 1 | -1>({
      startEvent,
      stopEvent,
    });
    const parseEvent = workflowEvent<number>({
      debugLabel: "parseEvent",
    });
    const parseResultEvent = workflowEvent<number>({
      debugLabel: "parseResult",
    });
    workflow.handle([startEvent], async () => {
      const ev = parseEvent(2);
      getContext().sendEvent(ev);
      // await getContext().requireEvent(parseResultEvent);
      return stopEvent(1);
    });
    workflow.handle([parseEvent], async ({ data }) => {
      if (data > 0) {
        const ev = parseEvent(data - 1);
        getContext().sendEvent(ev);
      } else {
        return parseResultEvent(0);
      }
    });
    const stream = readableStream(workflow, "100");
    const events: WorkflowEventData<any>[] = [];
    for await (const ev of stream) {
      events.push(ev);
    }
    expect(events.length).toBe(6);
    expect(events.at(-1)!.data).toBe(1);
    expect(events.map((e) => eventSource(e))).toEqual([
      startEvent,
      parseEvent,
      parseEvent,
      parseEvent,
      parseResultEvent,
      stopEvent,
    ]);
  });

  test("multiple parse", async () => {
    const startEvent = workflowEvent<string>({
      debugLabel: "startEvent",
    });
    const stopEvent = workflowEvent<1 | -1>({
      debugLabel: "stopEvent",
    });
    const workflow = createWorkflow<string, 1 | -1>({
      startEvent,
      stopEvent,
    });
    const parseEvent = workflowEvent<number>({
      debugLabel: "parseEvent",
    });
    const parseResultEvent = workflowEvent<number>({
      debugLabel: "parseResult",
    });
    workflow.handle([startEvent], async () => {
      const ev = parseEvent(2);
      getContext().sendEvent(ev);
      // await getContext().requireEvent(parseResultEvent);
      getContext().sendEvent(ev);
      // await getContext().requireEvent(parseResultEvent);
      return stopEvent(1);
    });
    workflow.handle([parseEvent], async ({ data }) => {
      if (data > 0) {
        const ev = parseEvent(data - 1);
        getContext().sendEvent(ev);
      } else {
        return parseResultEvent(0);
      }
    });

    const stream = readableStream(workflow, "100");
    const events: WorkflowEventData<any>[] = [];
    for await (const ev of stream) {
      events.push(ev);
    }
    expect(events.length).toBe(10);
    expect(events.at(-1)!.data).toBe(1);
    expect(events.map((e) => eventSource(e))).toEqual([
      startEvent,
      parseEvent,
      parseEvent,
      parseEvent,
      parseResultEvent,
      parseEvent,
      parseEvent,
      parseEvent,
      parseResultEvent,
      stopEvent,
    ]);
  });

  test("should exist in workflow", async () => {
    const workflow = createWorkflow({
      startEvent,
      stopEvent,
    });
    const fn = vi.fn(() => {
      const context = getContext();
      expect(context).toBeDefined();
      // expect(context.requireEvent).toBeTypeOf("function");
      expect(context.sendEvent).toBeTypeOf("function");
      return stopEvent();
    });
    workflow.handle([startEvent], fn);
    const stream = readableStream(workflow);
    const events: WorkflowEventData<any>[] = [];
    for await (const ev of stream) {
      events.push(ev);
    }
    expect(fn).toBeCalledTimes(1);
    expect(events).toHaveLength(2);
  });

  test("should work when request event single", async () => {
    const aEvent = workflowEvent({
      debugLabel: "aEvent",
    });
    const aResultEvent = workflowEvent({
      debugLabel: "aResultEvent",
    });
    const workflow = createWorkflow({
      startEvent,
      stopEvent,
    });
    const fn = vi.fn(async () => {
      const context = getContext();
      context.sendEvent(aEvent());
      // await context.requireEvent(aResultEvent);
      return stopEvent();
    });
    const fn2 = vi.fn(async () => {
      return aResultEvent();
    });
    workflow.handle([startEvent], fn);
    workflow.handle([aEvent], fn2);
    const stream = readableStream(workflow);
    const events: WorkflowEventData<any>[] = [];
    for await (const ev of stream) {
      events.push(ev);
    }
    expect(fn).toBeCalledTimes(1);
    expect(events.map((e) => eventSource(e))).toEqual([
      startEvent,
      aEvent,
      aResultEvent,
      stopEvent,
    ]);
    expect(events).toHaveLength(4);
  });
});
