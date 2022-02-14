import * as vscode from "vscode";
import * as path from "path";

import exec from "./exec";

const MAX_COUNT = 25;

export default class RelatedFilesProvider
  implements vscode.TreeDataProvider<RelatedFile>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    RelatedFile | undefined | null | void
  > = new vscode.EventEmitter<RelatedFile | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    RelatedFile | undefined | null | void
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

  getTreeItem(item: RelatedFile): vscode.TreeItem {
    return item;
  }

  async getChildren(): Promise<RelatedFile[]> {
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
      const activeFsPath = activeTextEditor.document.uri.fsPath;
      const workspaceFsPath = workspace.uri.fsPath;
      // TODO: Add caching or something similar

      console.log(
        `View for ${activeFsPath} in ${workspaceFsPath}`
      );

      // Check whether we're in a Git repository, throws if we're not
      await exec("git rev-parse --is-inside-work-tree", {
        cwd: workspaceFsPath,
      });

      /*
      const countsAndNames = await exec(
        // TODO: Is this safe to pass directly?
        `git log --follow --format=%H -- ${activeFsPath} | xargs -n1 git diff-tree --no-commit-id --name-only -r | sort | uniq -c | sort -bgr | head -${MAX_COUNT}`,
        {
          cwd: workspaceFsPath,
        }
      );
      return countsAndNames.map((line) => new RelatedFile(line));
      */

      const commitsForFile = await exec(
        // TODO: Is this safe to pass directly?
        `git log --follow --format=%H -- ${activeFsPath}`,
        {
          cwd: workspaceFsPath,
        }
      );
      // TODO: Validate output
      const fileNameLists = await Promise.all(
        commitsForFile.map((hash) =>
          exec(`git diff-tree --no-commit-id --name-only -r ${hash}`, {
            cwd: workspaceFsPath,
          })
        )
      );

      const fileNames = new Set<string>();
      const fileNameCounts = new Map<string, number>();
      for (var ii = 0; ii < fileNameLists.length; ii++) {
        const fileNameList = fileNameLists[ii];
        for (var jj = 0; jj < fileNameList.length; jj++) {
          const fileName = fileNameList[jj];
          const fullPath = path.resolve(workspaceFsPath, fileName);
          fileNames.add(fullPath);
          fileNameCounts.set(fullPath, (fileNameCounts.get(fullPath) ?? 0) + 1);
        }
      }

      return (
        Array.from(fileNames)
          .sort(
            (a, b) =>
              (fileNameCounts.get(b) ?? 0) - (fileNameCounts.get(a) ?? 0)
          )
          .slice(0, MAX_COUNT)
          // TODO: Filter out the file's own name
          .map((fileName) => new RelatedFile(fileName))
      );
    } catch (error) {
      console.log(error);
      // TODO: Do something useful with the error
      return [];
    }
  }
}

class RelatedFile extends vscode.TreeItem {
  constructor(public readonly fsPath: string) {
    super(fsPath, vscode.TreeItemCollapsibleState.None);
    const uri = vscode.Uri.file(fsPath);
    const label = path.basename(fsPath);
    this.label = label;
    this.tooltip = fsPath;
    this.resourceUri = uri;
    this.description = false;
    this.command = {
      title: `Open ${label}`,
      command: "vscode.open",
      arguments: [uri],
    };
  }
}
