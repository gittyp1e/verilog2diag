import type { Edge, Node } from "@xyflow/react";

export type Materialization = "real" | "virtual";

export type ArchitectureNodeData = {
  label: string;
  role: string;
  kind: "module" | "semantic_block";
  materialization: Materialization;
  source: string;
  reads?: string[];
  writes?: string[];
};

export type ArchitectureEdgeData = {
  label: string;
  kind: "dataflow" | "control";
  signals: string[];
};

export type ArchitectureNode = Node<ArchitectureNodeData, "architectureNode">;
export type ArchitectureEdge = Edge<ArchitectureEdgeData>;

export type SelectionState = {
  nodeIds: string[];
  edgeIds: string[];
};
