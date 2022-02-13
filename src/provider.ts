import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

import exec from "./exec";

// import * as shell from "execa";
// const execa = shell.execa;

export default class RelatedFilesProvider
  implements vscode.TreeDataProvider<Dependency>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    Dependency | undefined | null | void
  > = new vscode.EventEmitter<Dependency | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    Dependency | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor() {
    try {
      // If the user doesn't have git installed or whatnot, close the panel or whatnot
      // if (!shell.which("git")) {
      //   console.error("No git");
      // }
    } catch (error) {
      // TODO: Use error
      // TODO: Can we hide the panel altogether?
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item: Dependency): vscode.TreeItem {
    return item;
  }

  async getChildren(item?: Dependency): Promise<Dependency[]> {
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
        `View for ${activeTextEditor.document.uri.fsPath} in ${workspace.uri.fsPath}`
      );

      // Ensure we're in a Git repository, otherwise there's nothing to do, throws if not
      await exec("git rev-parse --is-inside-work-tree", {
        cwd: workspace.uri.fsPath,
      });

      const commitsForFile = await exec(
        // TODO: Is this safe to pass directly?
        `git log --follow --format=%H -- ${activeTextEditor.document.uri.fsPath}`,
        {
          cwd: workspace.uri.fsPath,
        }
      );
      // TODO: Validate output
      // console.log(commitsForFile);

      const fileNameLists = await Promise.all(
        commitsForFile.split(/\r?\n/).map((hash) =>
          exec(`git diff-tree --no-commit-id --name-only -r ${hash}`, {
            cwd: workspace.uri.fsPath,
          })
        )
      );

      console.log(fileNameLists);

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
