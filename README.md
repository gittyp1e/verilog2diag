# Blueprint

Blueprint is a VS Code-first prototype for a diagram-driven RTL architecture
agent.

## Development

Install dependencies:

```sh
npm install
```

Build the extension host and webview bundle:

```sh
npm run build
```

Run the extension from VS Code's Extension Development Host and execute:

```text
Blueprint: Open Architecture View
```

If a `.sv`, `.svh`, `.v`, or `.vh` editor is active, Blueprint diagrams that
file. Otherwise it opens a file picker. The current frontend builds a
single-file architecture graph from modules, ports, instances, continuous
assignments, and `always_*` blocks, then renders it in the existing diagram
canvas.

For extension-path diagnostics, run:

```text
Blueprint: Show Diagnostics
```
