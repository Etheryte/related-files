import * as vscode from "vscode";

import Provider from "./provider";

export function activate(context: vscode.ExtensionContext) {
  // See https://code.visualstudio.com/api/extension-guides/tree-view
  const provider = new Provider();
  vscode.window.registerTreeDataProvider("relatedFiles", provider);
  vscode.commands.registerCommand("relatedFiles.refresh", () =>
    provider.refresh()
  );
  // First load
  provider.refresh();

  // Whenever the active editor changes, update or empty the view accordingly
  vscode.window.onDidChangeActiveTextEditor(
    () => {
      provider.refresh();
    },
    null,
    context.subscriptions
  );

  // For every open file, preload related files
  for (const openDocument of vscode.workspace.textDocuments) {
    console.log("found", openDocument.uri.fsPath);
    const workspace = vscode.workspace.getWorkspaceFolder(openDocument.uri);
    if (workspace) {
      console.log("preload", openDocument.uri.fsPath);
      provider.preloadRelatedFilesFor(workspace.uri, openDocument.uri);
    }
  }

  // TODO: On startup, preload all tabs in all workspaces
  // TODO: When a new workspace is opened, preload all tabs
  // TODO: When a workspace is closed, clear cache for it
}

// this method is called when your extension is deactivated
export function deactivate() {}
