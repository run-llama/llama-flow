import "./style.css";
import Sigma from "sigma";
import { workflow } from "./workflow";
import { toSigma } from "@llama-flow/viz";
import ForceSupervisor from "graphology-layout-force/worker";

const container = document.getElementById("app") as HTMLElement;

// const graph = new Graph();
// graph.addNode("John", { x: 0, y: 10, size: 5, label: "John", color: "blue" });
// graph.addNode("Mary", { x: 10, y: 0, size: 3, label: "Mary", color: "red" });
// graph.addEdge("John", "Mary");
const graph = toSigma(workflow.getGraph());

graph.nodes().forEach((node, i) => {
  const angle = (i * 2 * Math.PI) / graph.order;
  graph.setNodeAttribute(node, "x", 100 * Math.cos(angle));
  graph.setNodeAttribute(node, "y", 100 * Math.sin(angle));
});

const layout = new ForceSupervisor(graph);
layout.start();

new Sigma(graph, container);
