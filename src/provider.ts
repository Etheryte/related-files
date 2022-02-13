import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

import exec from "./exec";

const MAX_COUNT = 25;

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
    console.log("item", item);
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

      // Check whether we're in a Git repository, throws if we're not
      await exec("git rev-parse --is-inside-work-tree", {
        cwd: workspace.uri.fsPath,
      });

      const countsAndNames = await exec(
        // TODO: Is this safe to pass directly?
        `git log --follow --format=%H -- ${activeTextEditor.document.uri.fsPath} | xargs -n1 git diff-tree --no-commit-id --name-only -r | sort | uniq -c | sort -bgr | head -${MAX_COUNT}`,
        {
          cwd: workspace.uri.fsPath,
        }
      );
      return countsAndNames.map(line => new Dependency(line));

      /*
      const commitsForFile = await exec(
        // TODO: Is this safe to pass directly?
        `git log --follow --format=%H -- ${activeTextEditor.document.uri.fsPath}`,
        {
          cwd: workspace.uri.fsPath,
        }
      );
      // TODO: Validate output
      const fileNameLists = await Promise.all(
        commitsForFile.map((hash) =>
          exec(`git diff-tree --no-commit-id --name-only -r ${hash}`, {
            cwd: workspace.uri.fsPath,
          })
        )
      );
      console.log(([] as any[]).concat.apply([], fileNameLists));
      */

      return [];
    } catch (error) {
      console.log(error);
      // TODO: Do something useful with the error
      return [];
    }
  }
}

class Dependency extends vscode.TreeItem {
  constructor(
    public readonly fsPath: string
  ) {
    super(fsPath, vscode.TreeItemCollapsibleState.None);
    const uri = vscode.Uri.file(fsPath);
    this.label = path.basename(fsPath);
    this.tooltip = fsPath;
    this.resourceUri = uri;
    this.description = false;
  }
}
