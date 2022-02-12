// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { NodeDependenciesProvider } from "./provider";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// See https://code.visualstudio.com/api/extension-guides/tree-view
	// TODO: See https://github.com/microsoft/vscode/wiki/Adopting-Multi-Root-Workspace-APIs#eliminating-rootpath
	const nodeDependenciesProvider = new NodeDependenciesProvider(vscode.workspace.rootPath);
	vscode.window.registerTreeDataProvider('relatedFiles', nodeDependenciesProvider);
	vscode.commands.registerCommand('relatedFiles.refresh', () =>
		nodeDependenciesProvider.refresh()
	);

	if (vscode.window.activeTextEditor) {
		console.log("Initial for setup " + vscode.window.activeTextEditor?.document.uri.toString());
	}

	// Whenever the active editor changes, update or empty the view accordingly
	vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			const file = editor.document.uri.toString();
			const maybeWorkspace = vscode.workspace.getWorkspaceFolder(editor.document.uri);
			if (!maybeWorkspace) {
				console.log("Empty the view");
				return;
			}
			const foo = maybeWorkspace?.uri.toString();
			console.log(`View for ${file} in ${foo}`);
		} else {
			console.log("Empty the view");
		}
	});
}

// this method is called when your extension is deactivated
export function deactivate() {}
