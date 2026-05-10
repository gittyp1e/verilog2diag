import type { ReactElement } from "react";
import { useCallback, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  type NodeProps,
  useEdgesState,
  useNodesState
} from "@xyflow/react";
import type { ArchitectureNode, SelectionState } from "./types";
import { sampleEdges, sampleNodes } from "./sampleGraph";

type DiagramCanvasProps = {
  onSelectionChange: (selection: SelectionState) => void;
};

const nodeTypes = {
  architectureNode: ArchitectureNodeView
};

export function DiagramCanvas({
  onSelectionChange
}: DiagramCanvasProps): ReactElement {
  const [nodes, setNodes, onNodesChange] = useNodesState(sampleNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(sampleEdges);

  const defaultViewport = useMemo(() => ({ x: 24, y: 42, zoom: 0.78 }), []);

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: {
      nodes: ArchitectureNode[];
      edges: typeof sampleEdges;
    }) => {
      onSelectionChange({
        nodeIds: selectedNodes.map((node) => node.id),
        edgeIds: selectedEdges.map((edge) => edge.id)
      });
    },
    [onSelectionChange]
  );

  return (
    <section className="diagram-region" aria-label="Architecture diagram">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={handleSelectionChange}
        defaultViewport={defaultViewport}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.35}
        maxZoom={1.7}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
      >
        <Background
          variant={BackgroundVariant.Lines}
          gap={24}
          color="var(--blueprint-grid-line)"
        />
        <MiniMap
          pannable
          zoomable
          nodeStrokeWidth={2}
          nodeColor={(node) =>
            node.data.materialization === "virtual"
              ? "var(--blueprint-virtual)"
              : "var(--blueprint-real)"
          }
        />
        <Controls showInteractive={false} />
        <Panel className="diagram-badge" position="top-left">
          Static sample graph
        </Panel>
      </ReactFlow>
    </section>
  );
}

function ArchitectureNodeView({
  data,
  selected
}: NodeProps<ArchitectureNode>): ReactElement {
  const isVirtual = data.materialization === "virtual";

  return (
    <article
      className={[
        "architecture-node",
        isVirtual ? "architecture-node-virtual" : "architecture-node-real",
        selected ? "architecture-node-selected" : ""
      ].join(" ")}
    >
      <Handle type="target" position={Position.Left} />
      <div className="node-header">
        <span className="node-title">{data.label}</span>
        <span className="node-kind">{isVirtual ? "Virtual" : "RTL"}</span>
      </div>
      <p>{data.role}</p>
      <div className="node-source">{data.source}</div>
      <Handle type="source" position={Position.Right} />
    </article>
  );
}
