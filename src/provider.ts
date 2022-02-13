import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import simpleGit, { SimpleGit } from "simple-git";

export default class RelatedFilesProvider
  implements vscode.TreeDataProvider<Dependency>
{
  private _git: SimpleGit | undefined;
  private _onDidChangeTreeData: vscode.EventEmitter<
    Dependency | undefined | null | void
  > = new vscode.EventEmitter<Dependency | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    Dependency | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor() {
    try {
      // TODO: This needs to change based on active file's workspace, see https://www.npmjs.com/package/simple-git#configuration
      // If the user doesn't have git installed or whatnot, this might fail
      this._git = simpleGit();
    } catch (error) {
      // TODO: Use error
      // TODO: Can we hide the panel altogether?
      // TODO: Also when there's no git repo at the location
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item: Dependency): vscode.TreeItem {
    return item;
  }

  async getChildren(item?: Dependency): Promise<Dependency[]> {
    // If we can't get git information, there's nothing to do
    if (!this._git) {
      return [];
    }
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

      const uri = activeTextEditor.document.uri.toString();
      console.log("checking log for " + uri);
      const foo = await this._git.log({
        file: uri,
        format: "%H",
        '--follow': null,
      });
      console.log(foo);

      return Promise.resolve([]);
    } catch (error) {
      console.log(error);
      // TODO: Do something useful with the error
      return [];
    }
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
