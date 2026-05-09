# Codex Build Prompt: Blueprint — VS Code RTL Architecture Agent

## What we are building

We are building **Blueprint**, a VS Code MVP for an autonomous RTL architecture agent.

Blueprint is not just a chatbot for Verilog/SystemVerilog and not just a static block diagram generator. It is a diagram-first agentic environment for understanding, editing, and refactoring RTL architecture.

The core idea:

> Blueprint reads a Verilog/SystemVerilog project, builds a compiler-grounded Architecture Graph, uses an LLM to infer meaningful semantic architecture blocks, renders a deterministic Draw.io-like block diagram, lets the user interact with the diagram and issue natural-language instructions grounded by diagram selection, and materializes architecture-level changes back into RTL with reviewable semantic code diffs and visual diagram diffs.

Our first target is a nontrivial in-order RISC-V CPU design of roughly 2,000 lines of RTL.

The MVP should be **VS Code-specific** for the hackathon. We can refactor toward editor/environment agnosticism later.

---

## Track alignment / agent story

This project is for an **Agents Track**. The agent story matters.

Blueprint should be framed as:

> An autonomous RTL architecture transformation agent that operates over a grounded Architecture Graph rather than raw source text alone.

The agent should be able to:

1. Observe the RTL project, Architecture Graph, selected diagram objects, and natural-language instruction.
2. Build localized context packets from selected graph objects.
3. Infer semantic blocks using an LLM, grounded in parsed RTL/IR facts.
4. Plan architecture-level transformations.
5. Generate patch transactions that modify RTL.
6. Produce semantic code diffs and normal diffs over the exact same patch set.
7. Produce visual diagram diffs.
8. Run a validation stub now, with room for real validators later.
9. Handle manual user code edits by rebuilding affected graph/diagram state and showing visual changes.

The key pitch:

> Blueprint is an agent that does architecture work, not just source-text completion.

The project should demonstrate that the agent can reason, plan, use tools, interact with external artifacts/files, make decisions under ambiguity, and produce useful outputs.

---

## Important interaction clarification

The user interface should **not** expose a fixed list of clickable command buttons as the main interaction model.

The expected interaction model is:

```text
Diagram interaction/selection and/or natural language
        ↓
context-augmented agent operation
        ↓
Architecture Graph transaction
        ↓
RTL patch / diagram update / diffs
```

Examples:

- User selects a virtual block in the diagram and types: “turn this into a real module”.
- User selects an edge and types: “insert a register stage here”.
- User selects a region and types: “split this into decode and execute”.
- User types without selection: “find the branch decision logic”.
- User drags or edits a diagram shape/connection, then describes intent in natural language if needed.

Under the hood, it is fine, and probably desirable, to map natural-language instructions to a constrained set of internal architecture operations such as `materialize_block`, `explain_selection`, `connect_blocks`, `insert_register`, etc.

But these should be **internal actions**, not prominent user-facing command buttons. The interface should feel like a diagram canvas plus natural-language control, not a form-based command palette.

---

## Product thesis

RTL encodes architecture implicitly. Blueprint makes that architecture explicit, editable, and synchronized with source code.

Current workflow:

```text
Read RTL manually
Draw architecture separately
Edit code manually
Hope the diagram stays up to date
Manually review line-order diffs
```

Blueprint workflow:

```text
Open RTL project in VS Code
Blueprint builds Architecture Graph
Diagram appears
User selects diagram objects and/or types natural language
Agent proposes architecture-level change
Agent materializes change into RTL patch
User reviews semantic code diff, normal diff, visual diff
User applies patch
Diagram updates
```

The differentiator versus Codex-like coding agents:

```text
Codex-style:
  prompt → source diff

Blueprint-style:
  diagram selection + natural language
    → graph context packet
    → architecture operation
    → tagged patch transaction
    → semantic code diff
    → visual architecture diff
    → optional validation
```

---

## MVP scope

Build a near prototype as quickly as possible.

The MVP is VS Code-first:

```text
VS Code extension
  ├── extension host
  │   ├── scans RTL files
  │   ├── runs parser/frontend adapter
  │   ├── owns Architecture Graph
  │   ├── calls LLM provider for semantic grouping / reasoning
  │   ├── generates architecture transactions
  │   ├── generates code patches and diffs
  │   ├── has validation provider stub
  │   └── writes files only after user applies patch
  │
  └── webview diagram UI
      ├── Draw.io-like canvas
      ├── deterministic ELK layout
      ├── selectable nodes/edges
      ├── natural-language input
      ├── inspector panel
      ├── semantic code diff panel
      ├── normal diff view or handoff
      └── visual diagram diff overlay
```

The MVP should include a path for exporting the current diagram to Draw.io/diagrams.net XML, but the live editor should be a custom Draw.io-like canvas, not the existing Draw.io extension.

---

## Fixed decisions

These decisions are currently fixed for the MVP:

### 1. VS Code-specific MVP

Do not over-abstract into a generic editor-independent product yet. Structure code cleanly, but ship a VS Code extension first.

### 2. Diagram UI: Option C

Build a custom Draw.io-like canvas using:

- React webview
- React Flow / `@xyflow/react` or equivalent node canvas
- ELK.js for deterministic auto-layout
- Custom Architecture Graph as the source of truth

Do **not** depend on the existing VS Code Draw.io extension for live editing.

### 3. Draw.io XML export path

The internal graph/scene graph should be exportable to `.drawio` XML later or in MVP if feasible.

Pipeline:

```text
Architecture Graph
  ↓
Diagram Compiler
  ↓
ELK layout
  ↓
Diagram Scene Graph
  ↓
React Flow renderer
  ↓
optional Draw.io XML exporter
```

The Draw.io export is a projection. Draw.io XML should not be the source of truth.

### 4. Deterministic layout

The LLM must not “vibe” diagram layout.

The LLM can infer semantic meaning and propose groupings. The deterministic visualization engine decides node placement, edge routing, layout stability, and visual style.

Principle:

> LLMs infer semantics; deterministic engines preserve structure.

### 5. LLM-based semantic grouping

Semantic grouping should be performed by the LLM using source code plus parsed/IR context. Do not require users to write heuristics for every design.

The LLM should produce structured semantic block proposals. Deterministic code should validate that proposals refer to real source spans and graph nodes.

### 6. Semantic grouping approval toggle

Semantic grouping approval should be configurable.

Safe mode:

```text
LLM proposes semantic groups
User approves before they become accepted/locked
```

Fast/danger mode:

```text
LLM semantic groups are accepted automatically
```

This is analogous to a `--dangerously-skip-permissions` mode in agentic coding tools.

Important: this toggle should only apply to semantic grouping. Code patches should still require explicit review/apply in the MVP.

### 7. Manual edits must be supported

Users may edit RTL manually. Blueprint should “deal with the consequences” while building.

For manual edits:

```text
User edits code
  ↓
File watcher notices change
  ↓
Affected graph regions are rebuilt or full graph is rebuilt initially
  ↓
Diagram updates
  ↓
Visual diagram diff / changed highlights are shown
```

Do not generate semantic code diffs by default for manual edits. Assume the user knows what they wrote. But show how the architecture diagram changed.

### 8. Validation stub

Leave a validation provider abstraction/stub.

We do not have validation tools chosen yet. The codebase should make it easy to plug in Verible, slang, Yosys, Verilator, or project-specific commands later.

For MVP:

```text
ValidationProvider.run(transaction): ValidationResult[]
```

Can return `not_configured` or simple placeholder success/failure.

### 9. Agent framework / LLM compatibility

Build on or isolate behind a separate agent runtime/library.

Must support common LLM APIs, especially OpenAI-compatible endpoints:

```text
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
```

The exact framework is not fully fixed. See “Open design decisions” below.

### 10. Semantic code diff equivalence

Semantic code diff must be a different grouping/view over the exact same patch set as the normal code diff.

Invariant:

```text
set(normalDiff.hunkIds) == set(semanticDiff.hunkIds)
```

No hunk may be omitted, duplicated, or invented.

Semantic diff is not a loose LLM summary. It is grouped actual code changes.

### 11. Golden demo action

The main demo action should be:

> Materialize a virtual semantic block as a real RTL module.

For the RISC-V CPU:

```text
Select virtual block: Branch Decision
Type: "turn this into a real module"
Agent creates transaction:
  - new branch_unit.sv
  - updates riscv_core.sv
  - adds instantiation/wires
  - removes/replaces inline logic as appropriate
  - shows semantic code diff
  - shows visual diff: virtual dashed block becomes solid real module
```

---

## Open design decisions to discuss with the team

These are not fully set in stone. Build with seams where possible.

### 1. HDL frontend choice

We need to survey/choose among Verible, slang, Surelog/UHDM, Yosys, or a narrow custom parser for the hackathon.

The first four-ish layers of the IR look like the frontend of a Verilog/SystemVerilog compiler. That is acceptable; we are effectively building/reusing a compiler frontend slice for architecture understanding.

Likely approach:

- Define a `FrontendAdapter` interface.
- Start with whichever adapter is fastest to implement.
- Permit a `MockFrontendAdapter` or narrow parser for the demo CPU if necessary.
- Keep the interface open for Verible/slang/Yosys/Surelog integration.

### 2. Agent framework

Candidate directions:

- Minimal custom `AgentRuntime` wrapper for speed.
- LangGraph.js for explicit stateful agent workflow.
- OpenAI Agents SDK for tool/handoff/tracing primitives.
- Vercel AI SDK for provider abstraction.
- LangChain.js if useful.

We want compatibility with OpenAI-compatible APIs. Do not hard-code to a single proprietary provider.

### 3. How real the materialization transform must be

The ideal MVP implements a real but constrained transformation.

Fallback acceptable for hackathon:

- General transaction architecture is real.
- Branch-decision materialization may be partly golden-path-specific for the demo CPU.
- The structure should make clear how to generalize.

### 4. Semantic overlay persistence

Because LLM semantic grouping may vary across runs, we need a cache/overlay model.

Likely `.blueprint/` files:

```text
.blueprint/
  graph-cache.json
  semantic-overlays.json
  layout.json
  transactions/
```

Open question: Should these files be committed, ignored, or optional? For MVP, local-only is probably fine.

### 5. Diagram editing freedom

Should the canvas allow arbitrary Draw.io-style freeform edits, or only architecture-valid edits?

Likely MVP:

- Allow familiar dragging, selecting, panning, zooming.
- Keep graph semantics authoritative.
- Avoid arbitrary shapes that are not backed by graph objects, unless treated as annotations.
- Natural-language instructions + selection should modify Architecture Graph, not raw visual shapes.

### 6. Validation behavior

Validation is a stub now. Later options:

- Verible lint/format
- slang parse/elaborate
- Yosys parse/elaborate/synthesis check
- Verilator lint
- custom project command

For now, do not block the MVP on this.

### 7. User approval boundaries

Fixed for code patches: user must review/apply.

Open for semantic groupings: approval can be toggled.

Need UI/setting design for this.

---

## Architecture concepts

### Source of truth

RTL source files are the source of truth.

Architecture Graph is derived/cached plus semantic overlays.

Pending diagram/agent edits create a transaction:

```text
RTL source
  ↓
Architecture Graph
  ↓
Diagram Scene Graph

User interaction / natural language
  ↓
ArchitectureTransaction
  ↓
Proposed graph changes + proposed code hunks
  ↓
Review
  ↓
Apply to RTL
  ↓
Rebuild graph
```

Do not let the graph drift indefinitely as a separate source of truth.

### Architecture Graph

The Architecture Graph is the core internal representation.

It should contain:

- real RTL modules
- real instances
- ports
- signals
- assignments / always blocks where useful
- inferred virtual semantic blocks
- source spans
- read/write sets where available
- data/control edges
- real vs virtual/materialized status
- semantic summaries/confidence/provenance
- parent/containment relationships

The graph should support localized context extraction for LLM prompts.

### Virtual vs materialized blocks

This is central.

A **virtual block** is inferred architecture that does not exist as a real RTL module.

Example:

```text
Branch Decision
  kind: semantic_block
  materialization: virtual
  source: riscv_core.sv lines 286-335
  reads: opcode, funct3, rs1_value, rs2_value, branch_imm
  writes: branch_taken, branch_target
```

A **materialized block** exists in RTL.

Example:

```text
module branch_unit (...)
```

The signature operation:

```text
Materialize virtual block
```

Meaning:

> Turn an inferred semantic region into a real RTL module and update the parent RTL accordingly.

### Semantic overlays

LLM outputs should be stored as semantic overlays, not as hard facts.

Each semantic block should know:

- source graph/hash it was derived from
- source spans
- included graph node IDs if available
- model/prompt version if useful
- confidence
- rationale
- status: `proposed | accepted | locked | stale`
- whether it was user-modified/renamed

---

## Proposed core data types

These are suggested, not necessarily final. Implement clean TypeScript interfaces.

```ts
export type SourceSpan = {
  file: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
};

export type NodeKind =
  | "module"
  | "instance"
  | "semantic_block"
  | "always_block"
  | "assign"
  | "signal"
  | "port"
  | "annotation";

export type Materialization = "real" | "virtual";

export type GraphNode = {
  id: string;
  kind: NodeKind;
  label: string;
  materialization: Materialization;
  parentId?: string;
  sourceSpans: SourceSpan[];
  metadata: {
    summary?: string;
    confidence?: number;
    rationale?: string;
    reads?: string[];
    writes?: string[];
    clock?: string;
    reset?: string;
    role?: string;
    status?: "proposed" | "accepted" | "locked" | "stale";
  };
};

export type EdgeKind =
  | "contains"
  | "instantiates"
  | "dataflow"
  | "control"
  | "clock"
  | "reset"
  | "semantic_grouping";

export type GraphEdge = {
  id: string;
  kind: EdgeKind;
  from: string;
  to: string;
  signals?: string[];
  sourceSpans?: SourceSpan[];
};

export type DesignGraph = {
  projectRoot: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  version: number;
};
```

---

## Diagram compiler and scene graph

The webview should not render directly from arbitrary LLM output.

Pipeline:

```text
DesignGraph
  ↓
DiagramCompiler
  ↓
ELK layout
  ↓
DiagramSceneGraph
  ↓
React Flow renderer
```

The Diagram Compiler should:

- decide which nodes/edges to show at current abstraction level
- distinguish real vs virtual blocks
- hide/compress clock/reset by default if necessary
- bundle related signals where possible
- preserve user-pinned positions
- provide stable layout for visual diffs
- make small graph changes produce small visual changes where feasible

Suggested visual conventions:

```text
solid border = real RTL module/block
dashed border = virtual semantic block
highlight green = added
highlight red = removed
highlight yellow/blue = changed
thin edge = lower-priority data/control flow
thick edge or bundled edge = signal bundle/interface
```

---

## Draw.io-like UX

The canvas should feel familiar to users of Draw.io/diagrams.net:

- pan/zoom
- select nodes/edges
- drag nodes
- inspect node metadata
- connect handles eventually
- auto-layout
- grouped blocks
- expand/collapse
- visual diff highlights

But every meaningful diagram object should be backed by an Architecture Graph object.

For MVP, avoid becoming a generic drawing app. Arbitrary annotation shapes can be supported later.

---

## Draw.io XML export

Implement or stub:

```ts
export function exportDrawioXml(scene: DiagramSceneGraph): string
```

The exporter should eventually convert deterministic scene graph geometry into diagrams.net XML (`mxCell`-style shapes/connectors). Include graph IDs in metadata/custom properties if possible so later import/round-trip is possible.

This is a projection/export, not the source of truth.

---

## Internal architecture operations

These are internal actions that natural language may map to. They should not necessarily appear as clickable commands in the UI.

Minimum internal operation set:

```ts
type ArchitectureOperationType =
  | "explain_selection"
  | "infer_semantic_blocks"
  | "materialize_block"
  | "show_diffs"
  | "export_drawio"
  | "rebuild_graph";
```

Leave room for future operations:

```ts
type FutureOperationType =
  | "split_block"
  | "merge_blocks"
  | "rename_block"
  | "bundle_signals"
  | "unbundle_edge"
  | "connect_blocks"
  | "insert_register"
  | "insert_mux"
  | "expose_signal_as_port"
  | "inline_module"
  | "repair_validation_error";
```

Natural-language interaction should produce an internal `ArchitectureCommand`:

```ts
export type ArchitectureCommand = {
  id: string;
  type: ArchitectureOperationType | string;
  selection: {
    nodeIds: string[];
    edgeIds: string[];
    sourceSpans?: SourceSpan[];
  };
  naturalLanguage?: string;
};
```

The agent can classify the user instruction into one of these operations, ask for clarification only when needed, and execute the corresponding tool/workflow.

---

## Transactions and patch model

Agent-authored changes should be represented as transactions.

```ts
export type ArchitectureTransaction = {
  id: string;
  title: string;
  command: ArchitectureCommand;
  graphBefore: DesignGraph;
  graphAfter?: DesignGraph;
  graphChanges: GraphChange[];
  codeHunks: CodeHunk[];
  semanticDiffGroups: SemanticDiffGroup[];
  validationResults: ValidationResult[];
  status: "proposed" | "applied" | "rejected" | "failed";
};
```

Code hunks should be first-class and tagged:

```ts
export type CodeHunk = {
  id: string;
  operationId: string;
  semanticGroupId: string;
  file: string;
  description: string;
  oldText?: string;
  newText: string;
  sourceSpan?: SourceSpan;
};
```

Normal diff view:

```text
group hunks by file and line/source position
```

Semantic code diff view:

```text
group the same hunks by semanticGroupId / operationId
```

Invariant:

```ts
new Set(normalDiff.hunkIds) === new Set(semanticDiff.hunkIds)
```

---

## Semantic code diff

Semantic code diff should look like a code diff, not a vague summary.

Example:

```text
Change 1: Materialized Branch Decision as branch_unit

  Created: branch_unit.sv
    + module branch_unit (...)
    + branch comparison logic
    + branch target output

  Modified: riscv_core.sv
    + declared branch_unit wires
    - removed inline branch comparison logic
    + added branch_unit instantiation
    + connected branch_taken to PC update

Validation:
  not configured / passed / failed
```

Every line-level code change shown here must correspond to a real hunk also visible in the normal diff.

---

## Visual diff

Visual diff is graph/diagram-level.

For agent edits:

```text
show semantic code diff + normal code diff + visual diagram diff
```

For manual edits:

```text
show visual diagram diff / changed diagram highlights by default
```

Example visual diff:

```text
Added:
  branch_unit

Changed:
  branch_decision virtual block became materialized module
  execute block no longer owns branch comparison
  pc_update now receives branch_taken from branch_unit

New edges:
  decode/control → branch_unit
  register_file → branch_unit
  branch_unit → pc_update
```

Represent graph changes as structured data:

```ts
export type GraphChange =
  | { kind: "node_added"; node: GraphNode }
  | { kind: "node_removed"; node: GraphNode }
  | { kind: "node_changed"; before: GraphNode; after: GraphNode }
  | { kind: "edge_added"; edge: GraphEdge }
  | { kind: "edge_removed"; edge: GraphEdge }
  | { kind: "edge_changed"; before: GraphEdge; after: GraphEdge };
```

---

## LLM semantic grouping workflow

The LLM should receive localized context packets, not the entire project blindly when avoidable.

Example context packet:

```json
{
  "selectedOrCandidateRegion": {
    "file": "riscv_core.sv",
    "startLine": 286,
    "endLine": 335
  },
  "sourceSnippet": "...",
  "reads": ["opcode", "funct3", "rs1_value", "rs2_value", "branch_imm"],
  "writes": ["branch_taken", "branch_target"],
  "neighboringBlocks": ["decode/control", "register_file", "pc_update"],
  "comments": ["branch compare", "next pc"],
  "existingGraphNodes": [...]
}
```

LLM output should be strict JSON, e.g.:

```json
{
  "semanticBlocks": [
    {
      "label": "Branch Decision",
      "role": "Determines whether the core should branch or fall through and computes branch target information.",
      "confidence": 0.91,
      "sourceSpans": [
        {
          "file": "riscv_core.sv",
          "startLine": 286,
          "endLine": 335
        }
      ],
      "reads": ["opcode", "funct3", "rs1_value", "rs2_value", "branch_imm"],
      "writes": ["branch_taken", "branch_target"],
      "rationale": "The region compares register operands based on funct3/opcode and drives branch_taken/branch_target."
    }
  ]
}
```

Then deterministic code validates:

- source spans exist
- spans are in project files
- reads/writes are plausible if known
- semantic blocks do not conflict badly
- overlaps are handled explicitly
- confidence/status are stored

---

## Agent runtime / provider abstraction

Implement an abstraction, even if simple:

```ts
export interface ModelProvider {
  completeJson<T>(request: {
    system: string;
    user: string;
    schemaName?: string;
  }): Promise<T>;
}
```

OpenAI-compatible provider should read:

```text
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
```

The provider should be swappable. Do not hard-code provider-specific behavior throughout the app.

If using an agent framework, keep it behind a small adapter so the rest of the app does not depend on one framework forever.

---

## Validation provider

Stub interface:

```ts
export type ValidationResult = {
  id: string;
  status: "passed" | "failed" | "not_configured";
  tool: string;
  message: string;
  diagnostics?: Array<{
    file?: string;
    line?: number;
    severity: "info" | "warning" | "error";
    message: string;
  }>;
};

export interface ValidationProvider {
  run(transaction: ArchitectureTransaction): Promise<ValidationResult[]>;
}
```

For MVP:

```text
NoopValidationProvider returns not_configured or passed with message:
"Validation provider not configured."
```

Later we can plug in Verible/slang/Yosys/Verilator/custom commands.

---

## Manual edit handling

Use VS Code file watchers.

Initial simple implementation can rebuild the full graph on change.

Better later:

```text
file changed
  ↓
identify affected source spans
  ↓
invalidate affected graph nodes
  ↓
rebuild affected regions
  ↓
mark stale semantic overlays
  ↓
update diagram
  ↓
show changed visual nodes/edges
```

For MVP, full rebuild is acceptable if fast enough.

If semantic overlay spans no longer match or source hash changes, mark them `stale`.

---

## Suggested repository structure

```text
blueprint-vscode/
  package.json
  tsconfig.json
  vite.config.ts
  src/
    extension.ts

    commands/
      openArchitectureView.ts
      rebuildGraph.ts
      exportDrawio.ts

    graph/
      types.ts
      GraphStore.ts
      graphDiff.ts
      contextPacket.ts

    frontend/
      FrontendAdapter.ts
      MockFrontendAdapter.ts
      RegexFrontendAdapter.ts
      # Future:
      # VeribleAdapter.ts
      # SlangAdapter.ts
      # YosysAdapter.ts

    semantics/
      SemanticGroupingAgent.ts
      SemanticOverlayStore.ts
      semanticPrompt.ts
      semanticValidation.ts

    agent/
      AgentRuntime.ts
      ModelProvider.ts
      OpenAICompatibleProvider.ts
      operationClassifier.ts

    transactions/
      ArchitectureCommand.ts
      ArchitectureTransaction.ts
      PatchPlanner.ts
      MaterializeBlockPlanner.ts
      SemanticDiff.ts
      NormalDiff.ts

    validation/
      ValidationProvider.ts
      NoopValidationProvider.ts

    drawio/
      exportDrawioXml.ts

    webview/
      getWebviewHtml.ts
      protocol.ts

  webview/
    src/
      main.tsx
      App.tsx
      DiagramCanvas.tsx
      InspectorPanel.tsx
      NaturalLanguageBox.tsx
      SemanticDiffPanel.tsx
      VisualDiffOverlay.tsx
      elkLayout.ts
      vscodeApi.ts
      types.ts
```

---

## VS Code commands

It is okay to have VS Code command palette commands for extension entry points and debugging, e.g.:

- `Blueprint: Open Architecture View`
- `Blueprint: Rebuild Architecture Graph`
- `Blueprint: Export Draw.io XML`
- `Blueprint: Clear Semantic Cache`

But inside the main UX, avoid explicit command buttons as the core interaction. The main UX should be diagram interaction + natural language.

---

## Webview protocol examples

Messages from webview to extension:

```ts
type WebviewToExtensionMessage =
  | { type: "ready" }
  | { type: "select"; nodeIds: string[]; edgeIds: string[] }
  | { type: "naturalLanguage"; text: string; selection: { nodeIds: string[]; edgeIds: string[] } }
  | { type: "requestRebuild" }
  | { type: "requestApplyTransaction"; transactionId: string }
  | { type: "requestExportDrawio" };
```

Messages from extension to webview:

```ts
type ExtensionToWebviewMessage =
  | { type: "graphUpdated"; graph: DesignGraph; scene: DiagramSceneGraph }
  | { type: "selectionContext"; context: unknown }
  | { type: "agentTrace"; event: unknown }
  | { type: "transactionProposed"; transaction: ArchitectureTransaction }
  | { type: "transactionApplied"; transactionId: string; graph: DesignGraph }
  | { type: "visualDiff"; changes: GraphChange[] }
  | { type: "error"; message: string };
```

---

## First golden path

The first end-to-end demo should be:

1. User opens VS Code workspace containing the RISC-V CPU.
2. User runs `Blueprint: Open Architecture View`.
3. Extension scans RTL files and builds initial `DesignGraph`.
4. LLM proposes semantic virtual blocks.
5. Diagram renders deterministic architecture view.
6. User selects virtual `Branch Decision` block.
7. User types: “turn this into a real module”.
8. Agent maps this to internal `materialize_block`.
9. Agent creates an `ArchitectureTransaction`.
10. Transaction includes code hunks:
    - create `branch_unit.sv`
    - update parent `riscv_core.sv`
    - add wires/ports/instantiation
    - remove/replace inline branch logic as appropriate
11. Semantic code diff shows hunks grouped under “Materialized Branch Decision as branch_unit”.
12. Normal code diff shows the same hunks by file/line.
13. Visual diff shows dashed virtual block becoming solid materialized block.
14. Validation stub runs.
15. User applies patch.
16. Files are updated.
17. Graph rebuilds and diagram reflects new real module.

If full general materialization is too hard immediately, implement this golden path in a constrained way while keeping the transaction/diff architecture general.

---

## Acceptance criteria for first prototype

1. VS Code extension can open a Blueprint architecture webview.
2. Webview renders a deterministic graph with nodes/edges.
3. ELK layout is used; node placement is not LLM-generated.
4. Extension can scan/load RTL project files.
5. Initial frontend adapter can produce at least basic module/port/source-span graph data.
6. Semantic grouping agent can call OpenAI-compatible API and produce virtual semantic blocks as strict JSON.
7. Semantic groups are rendered as dashed/virtual nodes.
8. User can select nodes/edges in the diagram.
9. User can type natural-language instruction grounded by current selection.
10. Agent maps natural language to an internal operation.
11. `materialize_block` operation creates an `ArchitectureTransaction`.
12. Transaction contains tagged code hunks.
13. Semantic code diff and normal diff are two views over the exact same hunks.
14. Visual diff is generated from graph before/after.
15. User can apply or reject proposed transaction.
16. Validation provider stub exists and runs.
17. Manual file edits trigger graph rebuild and visual update/change indication.
18. Draw.io XML export function exists, even if basic.
19. Code is modular enough to replace frontend adapter and validation provider later.
20. No silent file rewrites. Agent-authored code patches require review/apply.

---

## Things not required for MVP

Do not spend initial effort on:

- full SystemVerilog standard compliance
- formal equivalence
- timing analysis
- synthesis-quality netlist generation
- arbitrary full CPU generation from English
- perfect bidirectional Draw.io round-trip
- depending on existing Draw.io VS Code extension
- polished marketplace packaging
- supporting multiple editors

---

## Notes on HDL frontend direction

The team suspects that the first layers of the IR resemble a compiler frontend. That is fine.

We should reuse or be inspired by open-source HDL frontends/IRs:

- Verible: SystemVerilog parser/linter/formatter, useful for CST/source structure and linting.
- slang: modern SystemVerilog compiler/library, potentially very useful for editor/refactoring tools.
- Surelog/UHDM: powerful SystemVerilog frontend and UHDM database, heavier.
- Yosys/RTLIL/JSON: useful for elaborated structural design/netlist, but may lose source-level semantics needed for refactoring.
- Verilator: useful for linting/simulation-oriented parsing but may not be ideal as source-preserving refactor frontend.

Build `FrontendAdapter` so this choice can change.

---

## Notes on diagram infrastructure

Recommended MVP:

- React
- React Flow / `@xyflow/react`
- ELK.js

The diagram compiler should convert Architecture Graph nodes/edges into ELK input, run layout, then convert to React Flow nodes/edges.

ELK should be configured for layered left-to-right architecture diagrams where possible.

Design heuristics:

- real hierarchy first
- dataflow left-to-right
- control signals above datapath when feasible
- hide/compress clock/reset by default
- bundle related signals where feasible
- preserve existing/user-pinned layout where feasible
- stable layout for useful visual diffs

---

## Notes on agent behavior

The agent should expose trace/status to the UI, but not in a verbose way.

Example trace for materialization:

```text
Understanding selection...
Building context packet...
Planning architecture operation...
Generating patch transaction...
Generating semantic code diff...
Running validation...
Ready for review.
```

If operation is ambiguous, ask a targeted question.

Example:

```text
I can materialize this block either as a new standalone module file or as a nested module-like section in the same file. Which do you want?
```

But avoid asking questions unnecessarily. Use best-effort defaults for the golden path.

---

## Safety and trust

- Do not silently apply patches.
- Show semantic diff, normal diff, and visual diff before applying.
- Keep semantic grouping approval toggle separate from code patch approval.
- Store LLM outputs with provenance/confidence.
- Mark stale semantic overlays after manual edits.
- Keep deterministic graph facts separate from inferred semantic facts.
- Use strict JSON schemas for LLM outputs where possible.
- Avoid relying on the LLM for source locations unless validated.

---

## Suggested first implementation order

1. Scaffold VS Code extension with webview.
2. Render sample graph in Draw.io-like canvas.
3. Add ELK deterministic layout.
4. Define `DesignGraph`, `GraphNode`, `GraphEdge`, `SourceSpan`.
5. Add GraphStore and webview protocol.
6. Add basic frontend adapter for demo project.
7. Add semantic grouping provider with OpenAI-compatible model.
8. Render virtual semantic blocks.
9. Add selection inspector and natural-language box.
10. Add operation classifier for a tiny internal action set.
11. Implement `materialize_block` transaction for golden path.
12. Implement semantic code diff and normal diff from shared hunks.
13. Implement visual diff from graph before/after.
14. Add validation stub.
15. Add apply/reject transaction.
16. Add file watcher and rebuild on manual edits.
17. Add basic Draw.io XML exporter.
18. Polish demo flow around RISC-V CPU.

---

## Final north star

The demo should make this obvious:

> Blueprint lets a hardware engineer open a messy RISC-V CPU, see a useful architecture diagram, select an inferred Branch Decision block, say “turn this into a real module,” and review a semantic code diff plus visual architecture diff before applying the RTL refactor.

That is the MVP.
