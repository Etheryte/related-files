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
}

// this method is called when your extension is deactivated
export function deactivate() {}
