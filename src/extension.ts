import * as vscode from "vscode";
import { openArchitectureView } from "./commands/openArchitectureView";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("blueprint.openArchitectureView", () =>
      openArchitectureView(context)
    )
  );
}

export function deactivate(): void {
  // Nothing to dispose yet. Command subscriptions are owned by the extension context.
}
