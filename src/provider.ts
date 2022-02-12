import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export default class RelatedFilesProvider
  implements vscode.TreeDataProvider<Dependency>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    Dependency | undefined | null | void
  > = new vscode.EventEmitter<Dependency | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    Dependency | undefined | null | void
  > = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: Dependency): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: Dependency): Promise<Dependency[]> {
    const activeTextEditor = vscode.window.activeTextEditor;
    if (!activeTextEditor) {
      return [];
    }
    // Perhaps we could also check here, but for now let's not
    const workspace = vscode.workspace.getWorkspaceFolder(
      activeTextEditor.document.uri
    );
    if (!workspace) {
      return [];
    }
    try {
      // TODO: Add caching or something similar

      console.log(
        `View for ${activeTextEditor.document.uri.toString()} in ${workspace.uri.toString()}`
      );
      return Promise.resolve([]);
    } catch (error) {
      // TODO: Do something useful with the error
      return [];
    }
    /*

    if (element) {
      return Promise.resolve(
        this.getDepsInPackageJson(
          path.join(
            this.workspaceRoot,
            "node_modules",
            element.label,
            "package.json"
          )
        )
      );
    } else {
      const packageJsonPath = path.join(this.workspaceRoot, "package.json");
      if (this.pathExists(packageJsonPath)) {
        // vscode.window.showInformationMessage("Getting stuff");
        return Promise.resolve(this.getDepsInPackageJson(packageJsonPath));
      } else {
        // vscode.window.showInformationMessage("Workspace has no package.json");
        return Promise.resolve([]);
      }
    }
    */
  }
}

class Dependency extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    private version: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}-${this.version}`;
    this.description = false;
  }

  // TODO: Can we reuse file icons or sth?
  iconPath = {
    light: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "light",
      "dependency.svg"
    ),
    dark: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "dark",
      "dependency.svg"
    ),
  };
}
