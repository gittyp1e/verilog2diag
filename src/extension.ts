import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  console.log("Blueprint extension activated.");

  context.subscriptions.push(
    vscode.commands.registerCommand("blueprint.openArchitectureView", async (uri?: vscode.Uri) => {
      try {
        const { openArchitectureView } = await import("./commands/openArchitectureView");
        await openArchitectureView(context, uri);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(
          `Blueprint failed to open architecture view: ${message}`
        );
        throw error;
      }
    }),
    vscode.commands.registerCommand("blueprint.showDiagnostics", () => {
      const extension = vscode.extensions.getExtension("matto.blueprint-vscode");
      const diagnostics = [
        "Blueprint diagnostics",
        `extension id: matto.blueprint-vscode`,
        `activated: ${extension?.isActive ?? "unknown"}`,
        `extension path: ${context.extensionPath}`,
        `extension uri: ${context.extensionUri.toString()}`,
        `main module: ${context.asAbsolutePath("dist/extension.js")}`
      ].join("\n");

      void vscode.window.showInformationMessage(diagnostics, { modal: true });
      console.log(diagnostics);
    })
  );
}

export function deactivate(): void {
  // Nothing to dispose yet. Command subscriptions are owned by the extension context.
}
