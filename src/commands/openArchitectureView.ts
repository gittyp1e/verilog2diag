import * as vscode from "vscode";
import type { ArchitectureGraph } from "../architecture/diagramTypes";
import { buildArchitectureGraph } from "../systemverilog/architectureGraph";
import { parseSystemVerilogFile } from "../systemverilog/parser";
import { getWebviewHtml } from "../webviewHtml/getWebviewHtml";

const viewType = "blueprint.architectureView";

let currentPanel: vscode.WebviewPanel | undefined;
let currentGraph: ArchitectureGraph | undefined;

type WebviewMessage = {
  type?: string;
};

export async function openArchitectureView(
  context: vscode.ExtensionContext,
  candidateUri?: vscode.Uri
): Promise<void> {
  const input = await resolveSystemVerilogInput(candidateUri);

  if (!input) {
    return;
  }

  currentGraph = buildArchitectureGraph(
    parseSystemVerilogFile(input.text, input.fileName)
  );

  if (currentGraph.nodes.length === 0) {
    void vscode.window.showWarningMessage(
      `Blueprint did not find diagrammable RTL in ${currentGraph.sourceName}.`
    );
  }

  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One);
    postCurrentGraph(currentPanel);
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
  const panelDisposables: vscode.Disposable[] = [];
  postCurrentGraph(panel);

  panel.webview.onDidReceiveMessage(
    (message: WebviewMessage) => {
      if (message.type === "webviewReady") {
        postCurrentGraph(panel);
      }
    },
    undefined,
    panelDisposables
  );

  panel.onDidDispose(
    () => {
      currentPanel = undefined;
      panelDisposables.forEach((disposable) => {
        disposable.dispose();
      });
    },
    undefined,
    context.subscriptions
  );
}

async function resolveSystemVerilogInput(
  candidateUri: vscode.Uri | undefined
): Promise<{ fileName: string; text: string } | undefined> {
  if (candidateUri) {
    return readDocument(candidateUri);
  }

  const activeDocument = vscode.window.activeTextEditor?.document;

  if (activeDocument && isSystemVerilogDocument(activeDocument)) {
    return {
      fileName: activeDocument.fileName,
      text: activeDocument.getText()
    };
  }

  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: {
      "SystemVerilog / Verilog": ["sv", "svh", "v", "vh"]
    },
    title: "Select a SystemVerilog or Verilog file to diagram"
  });

  if (!picked?.[0]) {
    return undefined;
  }

  return readDocument(picked[0]);
}

async function readDocument(
  uri: vscode.Uri
): Promise<{ fileName: string; text: string }> {
  const document = await vscode.workspace.openTextDocument(uri);

  return {
    fileName: document.fileName,
    text: document.getText()
  };
}

function isSystemVerilogDocument(document: vscode.TextDocument): boolean {
  return (
    document.languageId === "systemverilog" ||
    document.languageId === "verilog" ||
    /\.(?:svh?|vh?)$/i.test(document.fileName)
  );
}

function postCurrentGraph(panel: vscode.WebviewPanel): void {
  if (!currentGraph) {
    return;
  }

  void panel.webview.postMessage({
    type: "architectureGraph",
    graph: currentGraph
  });
}
