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

export type ArchitectureNode = {
  id: string;
  type: "architectureNode";
  position: {
    x: number;
    y: number;
  };
  data: ArchitectureNodeData;
};

export type ArchitectureEdge = {
  id: string;
  source: string;
  target: string;
  type: "architectureWire";
  label: string;
  data: ArchitectureEdgeData;
  className?: string;
};

export type ArchitectureGraph = {
  sourceName: string;
  sourcePath: string;
  topModule?: string;
  diagnostics: string[];
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
};
