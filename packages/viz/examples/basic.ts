import { createWorkflow, workflowEvent, getContext } from "@llama-flow/core";
import { withGraph } from "@llama-flow/viz";

//#region define workflow events
const startEvent = workflowEvent<string>({
  debugLabel: "start",
});
const branchAEvent = workflowEvent<string>({
  debugLabel: "branchA",
});
const branchBEvent = workflowEvent<string>({
  debugLabel: "branchB",
});
const branchCEvent = workflowEvent<string>({
  debugLabel: "branchC",
});
const branchCompleteEvent = workflowEvent<string>({
  debugLabel: "branchComplete",
});
const allCompleteEvent = workflowEvent<string>({
  debugLabel: "allComplete",
});
const stopEvent = workflowEvent<string>({
  debugLabel: "stop",
});
//#endregion

//#region defines workflow
const workflow = withGraph(createWorkflow());
workflow.handle([startEvent], async () => {
  // emit 3 different events, handled separately
  const { sendEvent, stream } = getContext();
  sendEvent(branchAEvent.with("Branch A"));
  sendEvent(branchBEvent.with("Branch B"));
  sendEvent(branchCEvent.with("Branch C"));

  const results = await stream.filter(branchCompleteEvent).take(3).toArray();

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

//#endregion

const graph = workflow.getGraph();
console.log("--- Graph Nodes ---");
graph.forEachNode((node, attributes) => {
  console.log(`Node: ${node}, Attributes: ${JSON.stringify(attributes)}`);
});

console.log("\n--- Graph Edges ---");
graph.forEachEdge((edge, attributes, source, target) => {
  console.log(
    `Edge from ${source} to ${target} (ID: ${edge}), Attributes: ${JSON.stringify(attributes)}`,
  );
});
console.log("--- End of Graph Details ---");
