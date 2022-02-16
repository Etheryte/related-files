import * as vscode from "vscode";
import * as path from "path";
import { promises as fs } from "fs";

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

  /** A map from a workspace fsPath to a map of a file's fsPath to related files */
  private _cache = new Map<
    string,
    Map<string, Promise<RelatedFile[]> | undefined> | undefined
  >();

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
    const workspace = vscode.workspace.getWorkspaceFolder(
      activeTextEditor.document.uri
    );
    if (!workspace) {
      return [];
    }
    try {
      const workspaceFsPath = workspace.uri.fsPath;
      const activeFsPath = path.resolve(
        workspaceFsPath,
        activeTextEditor.document.uri.fsPath
      );
      return this._getCachedRelatedFilesFor(workspaceFsPath, activeFsPath);
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  preloadRelatedFilesFor(workspaceFsPath: string, fileFsPath: string) {
    this._getCachedRelatedFilesFor(workspaceFsPath, fileFsPath);
  }

  /** Either get related files from cache or cache them beforehand for future use */
  private async _getCachedRelatedFilesFor(
    workspaceFsPath: string,
    fileFsPath: string
  ): Promise<RelatedFile[]> {
    const cacheHit = this._cache.get(workspaceFsPath)?.get(fileFsPath);
    if (cacheHit) {
      return cacheHit;
    }

    const promise = this._getRelatedFilesFor(workspaceFsPath, fileFsPath);

    // Store in cache and return
    let cacheLocation = this._cache.get(workspaceFsPath);
    if (!cacheLocation) {
      cacheLocation = new Map();
      this._cache.set(workspaceFsPath, cacheLocation);
    }
    cacheLocation.set(fileFsPath, promise);
    return promise;
  }

  private async _getRelatedFilesFor(
    workspaceFsPath: string,
    fileFsPath: string
  ): Promise<RelatedFile[]> {
    // Check whether we're in a Git repository, throws if we're not
    await exec("git rev-parse --is-inside-work-tree", {
      cwd: workspaceFsPath,
    });

    const commitHashesForFsPath = await exec(
      // TODO: Is this safe to pass directly?
      `git log --follow --format=%H -- ${fileFsPath}`,
      {
        cwd: workspaceFsPath,
      }
    );
    // TODO: Validate output
    const relativeFsPathLists = await Promise.all(
      commitHashesForFsPath.map((hash) =>
        exec(`git diff-tree --no-commit-id --name-only -r ${hash}`, {
          cwd: workspaceFsPath,
        })
      )
    );

    const relativeFsPaths = new Set(relativeFsPathLists.flat());
    const fullFsPaths = new Set<string>();
    const fullFsPathCounts = new Map<string, number>();
    for await (const fileName of Array.from(relativeFsPaths)) {
      const fullFsPath = path.resolve(workspaceFsPath, fileName);

      // If the path is not the open file itself
      if (fullFsPath === fileFsPath) {
        continue;
      }

      try {
        // Only if the file exists
        await fs.stat(fullFsPath);
        fullFsPaths.add(fullFsPath);
        fullFsPathCounts.set(
          fullFsPath,
          (fullFsPathCounts.get(fullFsPath) ?? 0) + 1
        );
      } catch (_) {
        // Ignore the path since the file doesn't exists
      }
    }

    return Array.from(fullFsPaths)
      .sort(
        (a, b) =>
          (fullFsPathCounts.get(b) ?? 0) - (fullFsPathCounts.get(a) ?? 0)
      )
      .slice(0, MAX_COUNT)
      .map((fileName) => new RelatedFile(fileName));
  }
}

class RelatedFile extends vscode.TreeItem {
  constructor(public readonly fileFsPath: string) {
    super(fileFsPath, vscode.TreeItemCollapsibleState.None);

    const uri = vscode.Uri.file(fileFsPath);
    const label = path.basename(fileFsPath);
    this.label = label;
    // The id is used for the sameness check in the UI, ensure the label isn't used
    this.id = fileFsPath;
    this.tooltip = fileFsPath;
    this.resourceUri = uri;
    this.description = false;
    this.command = {
      title: `Open ${label}`,
      command: "vscode.open",
      arguments: [uri],
    };
  }
}
