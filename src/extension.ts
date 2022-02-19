import * as vscode from "vscode";

import Provider from "./provider";

export function activate(context: vscode.ExtensionContext) {
  // See https://code.visualstudio.com/api/extension-guides/tree-view
  const provider = new Provider();
  vscode.window.registerTreeDataProvider("relatedFiles", provider);

  // This is currently only for debugging
  vscode.commands.registerCommand("relatedFiles.refresh", () => {
    provider.clearCache();
    provider.updateView();
  });

  // First load
  provider.updateView();
  // Whenever the active editor changes, update or empty the view accordingly
  vscode.window.onDidChangeActiveTextEditor(
    () => {
      provider.updateView();
    },
    null,
    context.subscriptions
  );

  // TODO: This seems to yield only the active tab, can we somehow retrieve all tabs?
  // For open files, preload related files
  for (const openDocument of vscode.workspace.textDocuments) {
    const workspace = vscode.workspace.getWorkspaceFolder(openDocument.uri);
    if (workspace) {
      provider.preloadCacheFor(workspace.uri, openDocument.uri);
    }
  }
}

// this method is called when your extension is deactivated
export function deactivate() {
  // TODO: Do we need to clean up anything manually?
}
