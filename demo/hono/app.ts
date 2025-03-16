import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createHonoHandler } from "fluere/interrupter/hono";
import { toolCallWorkflow } from "../workflows/tool-call-agent";

const app = new Hono();

app.post("/workflow", createHonoHandler(toolCallWorkflow));

serve(app, ({ port }) => {
  console.log(`Server started at http://localhost:${port}`);
});
