# fluere

fluere 🌊 is a simple, lightweight workflow engine, inspired
by [LlamaIndex Workflow](https://docs.llamaindex.ai/en/stable/module_guides/workflow/)

[![Bundle Size](https://img.shields.io/bundlephobia/min/fluere)](https://bundlephobia.com/result?p=fluere)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/fluere)](https://bundlephobia.com/result?p=fluere)

- Minimal core API (<=2kb)
- 100% Type safe
- Event-driven, stream oriented programming
- Support multiple JS runtime/framework

## Usage

```shell
npm i fluere
```

### First, define events

```ts
import { workflowEvent } from "fluere";

const startEvent = workflowEvent<string>();
const stopEvent = workflowEvent<1 | -1>();
```

### Connect events with workflow

```ts
import { createWorkflow } from "fluere";

const convertEvent = workflowEvent();

const workflow = createWorkflow({
  startEvent,
  stopEvent,
});

workflow.handle([startEvent], (start) => {
  return convertEvent(Number.parseInt(start.data, 10));
});
workflow.handle([convertEvent], (convert) => {
  return stopEvent(convert.data > 0 ? 1 : -1);
});
```

### Trigger workflow

```ts
// core utility to trigger workflow, it will run until stopEvent is emitted
import { finalize } from "fluere";

const { data } = await finalize(workflow);

// you can also use any stream API, like node:stream to handle the workflow
import { pipeline } from "node:stream";

const { stream, sendEvent } = workflow.createContext();
sendEvent(startEvent());
const result = await pipeline(stream, async function (source) {
  for await (const event of source) {
    if (stopEvent.include(event)) {
      return "stop received!";
    }
  }
});
console.log(result); // stop received!
```

### Fan-out (Parallelism)

By default, we provide a simple fan-out utility to run multiple workflows in parallel

- `getContext().sendEvent` will emit a new event to current workflow
- `getContext().stream` will return a stream of events emitted by the sub-workflow

```ts
import { until } from "fluere/stream";

let condition = false;
workflow.handle([startEvent], (start) => {
  const { sendEvent, stream } = getContext();
  for (let i = 0; i < 10; i++) {
    sendEvent(convertEvent(i));
  }
  // You define the condition to stop the workflow
  const results = until(stream, () => condition).filter((ev) =>
    convertStopEvent.includes(ev),
  );
  console.log(results.length); // 10
  return stopEvent();
});

workflow.handle([convertEvent], (convert) => {
  if (convert.data === 9) {
    condition = true;
  }
  return convertStopEvent(/* ... */);
});
```

### With RxJS, or any stream API

Workflow is event-driven, you can use any stream API to handle the workflow like `rxjs`

```ts
import { from, pipe } from "rxjs";

const { stream, sendEvent } = workflow.createContext();

from(stream)
  .pipe(filter((ev) => eventSource(ev) === messageEvent))
  .subscribe((ev) => {
    console.log(ev.data);
  });

sendEvent(fileParseWorkflow.startEvent(directory));
```

### Connect with Server endpoint

Workflow can be used as a middleware in any server framework, like `express`, `hono`, `fastify`, etc.

```ts
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createHonoHandler } from "fluere/interrupter/hono";
import { agentWorkflow } from "../workflows/tool-call-agent.js";

const app = new Hono();

app.post(
  "/workflow",
  createHonoHandler(agentWorkflow, async (ctx) => ctx.req.text()),
);

serve(app, ({ port }) => {
  console.log(`Server started at http://localhost:${port}`);
});
```

### Error Handling

You can use `signal` in `getContext` to handle error

```ts
workflow.handle([convertEvent], () => {
  const { signal } = getContext();

  signal.onabort = () => {
    console.error("error in convert event:", abort.reason);
  };
});
```

### Pitfall in **browser**

You must call `getContext()` in the top level of the workflow, otherwise we will lose the async context of the workflow.

```ts
workflow.handle([startEvent], async () => {
  const { stream } = getContext(); // ✅ this is ok
  await fetchData();
});

workflow.handle([startEvent], async () => {
  await fetchData();
  const { stream } = getContext(); // ❌ this is not ok
  // we have no way to know this code was originally part of the workflow
  // w/o AsyncContext
});
```

Due to missing API of `async_hooks` in browser, we are looking
for [Async Context](https://github.com/tc39/proposal-async-context) to solve this problem in the future.

# LICENSE

MIT
