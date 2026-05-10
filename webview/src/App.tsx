import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { DiagramCanvas } from "./DiagramCanvas";
import { InspectorPanel } from "./InspectorPanel";
import { NaturalLanguageBox } from "./NaturalLanguageBox";
import { sampleEdges, sampleNodes } from "./sampleGraph";
import type { SelectionState } from "./types";

export function App(): ReactElement {
  const [selection, setSelection] = useState<SelectionState>({
    nodeIds: [],
    edgeIds: []
  });

  const handleSelectionChange = useCallback((nextSelection: SelectionState) => {
    setSelection(nextSelection);
  }, []);

  return (
    <main className="app-shell">
      <section className="top-bar">
        <div>
          <h1>Blueprint</h1>
          <p>RTL Architecture View</p>
        </div>
      </section>

      <section className="workspace">
        <DiagramCanvas onSelectionChange={handleSelectionChange} />
        <div className="side-panel">
          <InspectorPanel
            selection={selection}
            nodes={sampleNodes}
            edges={sampleEdges}
          />
          <NaturalLanguageBox selection={selection} />
        </div>
      </section>
    </main>
  );
}
