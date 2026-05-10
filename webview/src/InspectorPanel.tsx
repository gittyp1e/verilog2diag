import type { ReactElement } from "react";
import type { ArchitectureEdge, ArchitectureNode, SelectionState } from "./types";

type InspectorPanelProps = {
  selection: SelectionState;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  diagnostics: string[];
};

export function InspectorPanel({
  selection,
  nodes,
  edges,
  diagnostics
}: InspectorPanelProps): ReactElement {
  const selectedNode = nodes.find((node) => selection.nodeIds.includes(node.id));
  const selectedEdge = edges.find((edge) => selection.edgeIds.includes(edge.id));

  return (
    <aside className="inspector-panel" aria-label="Selection inspector">
      <div className="panel-heading">
        <h2>Inspector</h2>
        <span>{selection.nodeIds.length + selection.edgeIds.length} selected</span>
      </div>

      {selectedNode ? (
        <NodeInspector node={selectedNode} />
      ) : selectedEdge ? (
        <EdgeInspector edge={selectedEdge} />
      ) : diagnostics.length > 0 ? (
        <Diagnostics diagnostics={diagnostics} />
      ) : (
        <div className="empty-state">
          <h3>No selection</h3>
          <p>Select a block or edge in the diagram.</p>
        </div>
      )}
    </aside>
  );
}

function Diagnostics({ diagnostics }: { diagnostics: string[] }): ReactElement {
  return (
    <div className="inspector-content">
      <div>
        <span className="field-label">Parser</span>
        <h3>Diagnostics</h3>
      </div>
      <ul className="diagnostic-list">
        {diagnostics.map((diagnostic) => (
          <li key={diagnostic}>{diagnostic}</li>
        ))}
      </ul>
    </div>
  );
}

function NodeInspector({ node }: { node: ArchitectureNode }): ReactElement {
  return (
    <div className="inspector-content">
      <div>
        <span className="field-label">Block</span>
        <h3>{node.data.label}</h3>
      </div>
      <p>{node.data.role}</p>
      <dl>
        <div>
          <dt>Kind</dt>
          <dd>{node.data.kind}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{node.data.materialization}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{node.data.source}</dd>
        </div>
      </dl>
      <SignalList title="Reads" signals={node.data.reads ?? []} />
      <SignalList title="Writes" signals={node.data.writes ?? []} />
    </div>
  );
}

function EdgeInspector({ edge }: { edge: ArchitectureEdge }): ReactElement {
  return (
    <div className="inspector-content">
      <div>
        <span className="field-label">Edge</span>
        <h3>{edge.label}</h3>
      </div>
      <dl>
        <div>
          <dt>Kind</dt>
          <dd>{edge.data?.kind ?? "dataflow"}</dd>
        </div>
        <div>
          <dt>From</dt>
          <dd>{edge.source}</dd>
        </div>
        <div>
          <dt>To</dt>
          <dd>{edge.target}</dd>
        </div>
      </dl>
      <SignalList title="Signals" signals={edge.data?.signals ?? []} />
    </div>
  );
}

function SignalList({
  title,
  signals
}: {
  title: string;
  signals: string[];
}): ReactElement {
  return (
    <section className="signal-section">
      <h4>{title}</h4>
      {signals.length > 0 ? (
        <ul>
          {signals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
      ) : (
        <p>None</p>
      )}
    </section>
  );
}
