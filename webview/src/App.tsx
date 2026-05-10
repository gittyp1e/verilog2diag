import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { MarkerType } from "@xyflow/react";
import { DiagramCanvas } from "./DiagramCanvas";
import { InspectorPanel } from "./InspectorPanel";
import { NaturalLanguageBox } from "./NaturalLanguageBox";
import { sampleGraph } from "./sampleGraph";
import type { ArchitectureEdge, ArchitectureGraph, SelectionState } from "./types";

type VsCodeApi = {
  postMessage: (message: unknown) => void;
};

type InboundMessage = {
  type?: string;
  graph?: ArchitectureGraph;
};

declare function acquireVsCodeApi(): VsCodeApi;

let vscodeApi: VsCodeApi | undefined;

export function App(): ReactElement {
  const [graph, setGraph] = useState<ArchitectureGraph>(sampleGraph);
  const [selection, setSelection] = useState<SelectionState>({
    nodeIds: [],
    edgeIds: []
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent<InboundMessage>) => {
      if (event.data.type === "architectureGraph" && event.data.graph) {
        setGraph(normalizeGraph(event.data.graph));
        setSelection({ nodeIds: [], edgeIds: [] });
      }
    };

    window.addEventListener("message", handleMessage);
    getVsCodeApi()?.postMessage({ type: "webviewReady" });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const handleSelectionChange = useCallback((nextSelection: SelectionState) => {
    setSelection(nextSelection);
  }, []);

  return (
    <main className="app-shell">
      <section className="top-bar">
        <div>
          <h1>Blueprint</h1>
          <p>{getSubtitle(graph)}</p>
        </div>
      </section>

      <section className="workspace">
        <DiagramCanvas
          nodes={graph.nodes}
          edges={graph.edges}
          sourceName={graph.sourceName}
          onSelectionChange={handleSelectionChange}
        />
        <div className="side-panel">
          <InspectorPanel
            selection={selection}
            nodes={graph.nodes}
            edges={graph.edges}
            diagnostics={graph.diagnostics}
          />
          <NaturalLanguageBox selection={selection} />
        </div>
      </section>
    </main>
  );
}

function getVsCodeApi(): VsCodeApi | undefined {
  if (vscodeApi) {
    return vscodeApi;
  }

  if (typeof acquireVsCodeApi !== "function") {
    return undefined;
  }

  vscodeApi = acquireVsCodeApi();
  return vscodeApi;
}

function normalizeGraph(graph: ArchitectureGraph): ArchitectureGraph {
  return {
    ...graph,
    edges: graph.edges.map(normalizeEdge)
  };
}

function normalizeEdge(edge: ArchitectureEdge): ArchitectureEdge {
  const kind = edge.data?.kind ?? "dataflow";

  return {
    ...edge,
    type: "architectureWire",
    markerEnd: edge.markerEnd ?? {
      type: MarkerType.ArrowClosed
    },
    className: edge.className ?? (kind === "control" ? "edge-control" : "edge-dataflow")
  };
}

function getSubtitle(graph: ArchitectureGraph): string {
  if (graph.topModule) {
    return `${graph.sourceName} / ${graph.topModule}`;
  }

  return graph.sourceName === "sample graph"
    ? "RTL Architecture View"
    : graph.sourceName;
}
