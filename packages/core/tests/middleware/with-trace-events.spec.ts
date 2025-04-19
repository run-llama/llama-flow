import { describe, test, vi, expectTypeOf, type Mock, expect } from "vitest";
import { createWorkflow, getContext, workflowEvent } from "@llama-flow/core";
import {
  withTraceEvents,
  runOnce,
  createHandlerDecorator,
  getEventOrigins,
} from "@llama-flow/core/middleware/trace-events";
import { filter } from "@llama-flow/core/stream/filter";
import { collect } from "@llama-flow/core/stream/consumer";
import { until } from "@llama-flow/core/stream/until";
import { pipeline } from "node:stream/promises";

describe("with trace events", () => {
  test("runOnce", () => {
    const workflow = withTraceEvents(createWorkflow());
    const startEvent = workflowEvent();
    const ref = workflow.handle([startEvent], runOnce(vi.fn(() => {})));
    expectTypeOf(ref.handler).toEqualTypeOf<Mock<() => void>>();
    {
      const { sendEvent } = workflow.createContext();
      expect(ref.handler).not.toHaveBeenCalled();
      sendEvent(startEvent.with());
      expect(ref.handler).toBeCalledTimes(1);
      sendEvent(startEvent.with());
      expect(ref.handler).toBeCalledTimes(1);
    }
    ref.handler.mockReset();
    {
      const { sendEvent } = workflow.createContext();
      expect(ref.handler).not.toHaveBeenCalled();
      sendEvent(startEvent.with());
      expect(ref.handler).toBeCalledTimes(1);
    }
  });

  test("substream", async () => {
    const workflow = withTraceEvents(createWorkflow());
    const startEvent = workflowEvent({
      debugLabel: "startEvent",
    });
    const messageEvent = workflowEvent<number>({
      debugLabel: "messageEvent",
    });
    let counter = 0;
    workflow.handle([startEvent], () => {
      getContext().sendEvent(messageEvent.with(counter++));
    });

    const context = workflow.createContext();
    const stream = context.stream;
    const ev = startEvent.with();
    context.sendEvent(ev);
    context.sendEvent(startEvent.with());
    context.sendEvent(startEvent.with());

    const [l, r] = stream.tee();
    const allEvents = await collect(
      until(l, (ev) => messageEvent.include(ev) && ev.data === 2),
    );
    const events = await collect(
      filter(
        workflow.substream(
          ev,
          until(r, (ev) => ev.data === 2),
        ),
        (e) => messageEvent.include(e),
      ),
    );
    expect(counter).toBe(3);
    expect(allEvents.length).toBe(6);
    expect(events.length).toBe(1);
  });

  test("should not call once", async () => {
    const workflow = withTraceEvents(createWorkflow());
    const startEvent = workflowEvent({
      debugLabel: "startEvent",
    });
    const messageEvent = workflowEvent<number>({
      debugLabel: "messageEvent",
    });
    let counter = 0;
    workflow.handle([startEvent], () => {
      getContext().sendEvent(messageEvent.with(counter++));
    });

    const context = workflow.createContext();
    const stream = context.stream;
    const ev = startEvent.with();
    context.sendEvent(ev);
    context.sendEvent(startEvent.with());
    context.sendEvent(startEvent.with());
    const events = await collect(
      until(stream, (ev) => messageEvent.include(ev) && ev.data === 2),
    );
    expect(events.length).toBe(6);
  });

  test("example: no parallel", async () => {
    const workflow = withTraceEvents(createWorkflow());
    const startEvent = workflowEvent();
    type Metadata = {
      running: boolean;
    };
    const getInitialValue = vi.fn(
      (): Metadata => ({
        running: false,
      }),
    );
    const resolvedSet = new WeakSet<object>();
    const noParallel = createHandlerDecorator<Metadata>({
      getInitialValue,
      onAfterHandler: () => ({
        running: false,
      }),
      onBeforeHandler: (h, handlerContext, metadata) => async () => {
        metadata.running = true;
        const root = handlerContext.root;
        const similarContexts = [];
        const queue = [root];
        while (queue.length > 0) {
          const current = queue.pop();
          if (!current) {
            break;
          }
          if (
            handlerContext !== current &&
            current.handler === handlerContext.handler
          ) {
            similarContexts.push(current);
          }
          queue.push(...current.next);
        }
        const asyncContexts = similarContexts
          .filter((c) => c.async)
          .filter((c) => !resolvedSet.has(c));
        for (const context of asyncContexts) {
          await context.pending;
          resolvedSet.add(context);
        }
        return h();
      },
    });
    let count = 0;
    let resolveNext: () => void = null!;
    let p = new Promise<void>((_resolve) => {
      resolveNext = _resolve;
    });
    let result: number[] = [];
    const ref = workflow.handle(
      [startEvent],
      noParallel(
        vi.fn(async () => {
          count++;
          const curr = count;
          await p.then(() => {
            result.push(curr);
            p = new Promise<void>((_resolve) => {
              resolveNext = _resolve;
            });
          });
        }),
      ),
    );
    expectTypeOf(ref.handler).toEqualTypeOf<Mock<() => Promise<void>>>();
    const { sendEvent } = workflow.createContext();
    expect(ref.handler).not.toHaveBeenCalled();
    sendEvent(startEvent.with());
    sendEvent(startEvent.with());
    sendEvent(startEvent.with());
    expect(ref.handler).toBeCalledTimes(1);
    expect(result).toEqual([]);
    resolveNext();
    await vi.waitFor(() => expect(result).toEqual([1]));
    resolveNext();
    await vi.waitFor(() => expect(result).toEqual([1, 2]));
    resolveNext();
    await vi.waitFor(() => expect(result).toEqual([1, 2, 3]));
    expect(ref.handler).toBeCalledTimes(3);
    resolveNext();
    sendEvent(startEvent.with());
    expect(result).toEqual([1, 2, 3]);
    expect(ref.handler).toBeCalledTimes(3);
    resolveNext();
    await vi.waitFor(() => expect(result).toEqual([1, 2, 3, 4]));
    expect(ref.handler).toBeCalledTimes(4);
  });
});

describe("get event origins", () => {
  test("should get event origins", async () => {
    const startEvent = workflowEvent<string>({
      debugLabel: "startEvent",
    });
    const branchAEvent = workflowEvent<string>({
      debugLabel: "branchAEvent",
    });
    const branchBEvent = workflowEvent<string>({
      debugLabel: "branchBEvent",
    });
    const branchCEvent = workflowEvent<string>({
      debugLabel: "branchCEvent",
    });
    const branchCompleteEvent = workflowEvent<string>({
      debugLabel: "branchCompleteEvent",
    });
    const allCompleteEvent = workflowEvent<string>({
      debugLabel: "allCompleteEvent",
    });
    const stopEvent = workflowEvent<string>({
      debugLabel: "stopEvent",
    });

    const workflow = withTraceEvents(createWorkflow());
    workflow.handle([startEvent], async () => {
      const { sendEvent, stream } = getContext();
      const context = getContext();
      sendEvent(branchAEvent.with("Branch A"));
      sendEvent(branchBEvent.with("Branch B"));
      sendEvent(branchCEvent.with("Branch C"));

      let condition = 0;
      const results = await collect(
        until(
          filter(stream, (ev) => branchCompleteEvent.include(ev)),
          () => {
            condition++;
            return condition === 3;
          },
        ),
      );

      const result = Object.groupBy(
        results,
        (e) => `${getEventOrigins(e, context)[0]}`,
      );
      expect(result).toMatchInlineSnapshot(`
        {
          "branchAEvent(1)": [
            {
              "data": "Branch A",
              "event": "4",
            },
          ],
          "branchBEvent(3)": [
            {
              "data": "Branch B",
              "event": "4",
            },
          ],
          "branchCEvent(5)": [
            {
              "data": "Branch C",
              "event": "4",
            },
          ],
        }
      `);

      return allCompleteEvent.with(results.map((e) => e.data).join(", "));
    });

    workflow.handle([branchAEvent], (branchA) => {
      return branchCompleteEvent.with(branchA.data);
    });

    workflow.handle([branchBEvent], (branchB) => {
      return branchCompleteEvent.with(branchB.data);
    });

    workflow.handle([branchCEvent], (branchC) => {
      return branchCompleteEvent.with(branchC.data);
    });

    workflow.handle([allCompleteEvent], (allComplete) => {
      return stopEvent.with(allComplete.data);
    });

    const { stream, sendEvent } = workflow.createContext();
    sendEvent(startEvent.with("initial data"));

    const result = await pipeline(stream, async function (source) {
      for await (const event of source) {
        if (stopEvent.include(event)) {
          return `Result: ${event.data}`;
        }
      }
    });
  });
});
