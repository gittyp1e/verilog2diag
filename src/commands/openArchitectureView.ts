import * as vscode from "vscode";
import { getWebviewHtml } from "../webviewHtml/getWebviewHtml";

const viewType = "blueprint.architectureView";

let currentPanel: vscode.WebviewPanel | undefined;

export function openArchitectureView(context: vscode.ExtensionContext): void {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    viewType,
    "Blueprint Architecture",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "dist", "webview")
      ]
    }
  );

  currentPanel = panel;
  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

  panel.onDidDispose(
    () => {
      currentPanel = undefined;
    },
    undefined,
    context.subscriptions
  );
}
