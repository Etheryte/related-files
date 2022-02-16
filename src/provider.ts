import * as vscode from "vscode";
import * as path from "path";
import { promises as fs } from "fs";

import exec from "./exec";

// TODO: Make this configurable?
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
      return this._getCachedRelatedFilesFor(
        workspace.uri,
        activeTextEditor.document.uri
      );
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  preloadRelatedFilesFor(workspaceUri: vscode.Uri, fileUri: vscode.Uri) {
    this._getCachedRelatedFilesFor(workspaceUri, fileUri);
  }

  /** Either get related files from cache or cache them beforehand for future use */
  private async _getCachedRelatedFilesFor(
    workspaceUri: vscode.Uri,
    fileUri: vscode.Uri
  ): Promise<RelatedFile[]> {
    const workspaceFsPath = workspaceUri.fsPath;
    const fileFsPath = path.resolve(workspaceFsPath, fileUri.fsPath);
    const cacheHit = this._cache.get(workspaceFsPath)?.get(fileFsPath);
    if (cacheHit) {
      return cacheHit;
    }

    const promise = this._getRelatedFilesFor(workspaceFsPath, fileFsPath);
    let workspaceCache = this._cache.get(workspaceFsPath);
    if (!workspaceCache) {
      workspaceCache = new Map();
      this._cache.set(workspaceFsPath, workspaceCache);
    }
    workspaceCache.set(fileFsPath, promise);
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

    const fullFsPaths = new Set<string>();
    const fullFsPathCounts = new Map<string, number>();
    for await (const fileName of relativeFsPathLists.flat()) {
      const fullFsPath = path.resolve(workspaceFsPath, fileName);

      // If the path is not the open file itself
      if (fullFsPath === fileFsPath) {
        continue;
      }

      try {
        // Check if file exists
        // TODO: Check only once
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

    console.log(fullFsPathCounts);

    return Array.from(fullFsPaths)
      .sort(
        (a, b) =>
          // Sort primarily by count
          (fullFsPathCounts.get(b) ?? 0) - (fullFsPathCounts.get(a) ?? 0) ||
          // And then alphabetically
          b.localeCompare(a)
      )
      .slice(0, MAX_COUNT)
      .map(
        (fullFsPath) =>
          new RelatedFile(fullFsPath, fullFsPathCounts.get(fullFsPath))
      );
  }
}

// TODO: If the label matches the open file label (multiple files with same name), show a longer path
class RelatedFile extends vscode.TreeItem {
  constructor(
    public readonly fileFsPath: string,
    count?: number,
    longLabel: boolean = false
  ) {
    super(fileFsPath, vscode.TreeItemCollapsibleState.None);

    const uri = vscode.Uri.file(fileFsPath);
    this.label = longLabel ? fileFsPath : path.basename(fileFsPath);
    // The id is used for the sameness check in the UI, ensure the label isn't used
    this.id = fileFsPath;
    this.tooltip = fileFsPath;
    this.resourceUri = uri;
    this.description = count
      ? `${count} ${count > 1 ? "commits" : "commit"}`
      : undefined;
    this.command = {
      title: `Open ${path.basename(fileFsPath)}`,
      command: "vscode.open",
      arguments: [uri],
    };
  }
}
