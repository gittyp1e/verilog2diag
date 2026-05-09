import type { ReactElement } from "react";

export function App(): ReactElement {
  return (
    <main className="app-shell">
      <section className="top-bar">
        <div>
          <h1>Blueprint</h1>
          <p>RTL Architecture View</p>
        </div>
      </section>

      <section className="canvas-placeholder" aria-label="Architecture canvas">
        <div className="canvas-grid">
          <div className="placeholder-node placeholder-node-primary">
            Architecture Canvas
          </div>
          <div className="placeholder-node">Inspector</div>
          <div className="placeholder-node">Agent Input</div>
        </div>
      </section>
    </main>
  );
}
