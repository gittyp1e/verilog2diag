import type { ReactElement } from "react";
import type { SelectionState } from "./types";

type NaturalLanguageBoxProps = {
  selection: SelectionState;
};

export function NaturalLanguageBox({
  selection
}: NaturalLanguageBoxProps): ReactElement {
  const selectedCount = selection.nodeIds.length + selection.edgeIds.length;

  return (
    <section className="agent-box" aria-label="Natural language command">
      <div className="panel-heading">
        <h2>Agent Input</h2>
        <span>
          {selectedCount > 0 ? `${selectedCount} selected` : "No selection"}
        </span>
      </div>
      <textarea
        aria-label="Architecture instruction"
        placeholder="turn this into a real module"
        spellCheck={false}
      />
    </section>
  );
}
