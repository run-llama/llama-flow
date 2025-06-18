import type Graph from "graphology";

export function toSigma(graph: Graph): Graph {
  const sigmaGraph = graph.copy();

  sigmaGraph.forEachNode((node, attributes) => {
    if (attributes.type === "handler") {
      sigmaGraph.mergeNodeAttributes(node, {
        size: 20,
        color: "red",
      });
      sigmaGraph.removeNodeAttribute(node, "type");
    }
    if (attributes.type === "event") {
      sigmaGraph.mergeNodeAttributes(node, {
        size: 10,
        color: "blue",
      });
      sigmaGraph.removeNodeAttribute(node, "type");
    }
  });

  sigmaGraph.forEachEdge((edge, attributes) => {
    sigmaGraph.mergeEdgeAttributes(edge, {
      type: "arrow",
      size: 3,
    });
  });

  return sigmaGraph;
}
