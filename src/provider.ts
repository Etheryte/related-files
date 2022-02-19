import * as vscode from "vscode";
import * as path from "path";
import { promises as fs } from "fs";

import RelatedFile from "./relatedFile";
import Cache from "./cache";
import execGit from "./exec";

// TODO: Make this configurable?
const MAX_COUNT = 25;
const HASH_REGEX = /^[a-f0-9]{40}$/;

export default class RelatedFilesProvider
  implements vscode.TreeDataProvider<RelatedFile>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    RelatedFile | undefined | null | void
  > = new vscode.EventEmitter<RelatedFile | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    RelatedFile | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private _cache = new Cache<Promise<RelatedFile[]>>();

  refresh(): void {
    // Update the tree view
    this._onDidChangeTreeData.fire();

    // Clean up old cache entries
    setTimeout(() => {
      this._cache.clearOldEntries();
    }, 0);
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

  preloadCacheFor(workspaceUri: vscode.Uri, fileUri: vscode.Uri): void {
    this._getCachedRelatedFilesFor(workspaceUri, fileUri);
  }

  /** Either get related files from cache or cache them beforehand for future use */
  private async _getCachedRelatedFilesFor(
    workspaceUri: vscode.Uri,
    fileUri: vscode.Uri
  ): Promise<RelatedFile[]> {
    const cacheHit = this._cache.get(workspaceUri, fileUri);
    if (cacheHit) {
      return cacheHit;
    }
    const promise = this._getRelatedFilesFor(workspaceUri, fileUri);
    this._cache.set(workspaceUri, fileUri, promise);
    return promise;
  }

  private async _getRelatedFilesFor(
    workspaceUri: vscode.Uri,
    fileUri: vscode.Uri
  ): Promise<RelatedFile[]> {
    const workspaceFsPath = workspaceUri.fsPath;
    const fileFsPath = path.resolve(workspaceFsPath, fileUri.fsPath);

    // Check whether we're in a Git repository, throws if we're not
    await execGit("rev-parse --is-inside-work-tree", {
      cwd: workspaceFsPath,
    });

    const commitHashesForFsPath = await execGit(
      // TODO: Is this safe to pass directly?
      `log --follow --format=%H -- ${fileFsPath}`,
      {
        cwd: workspaceFsPath,
      }
    );
    if (!commitHashesForFsPath.length) {
      return [];
    }

    const validHashes = commitHashesForFsPath.filter((hash) =>
      HASH_REGEX.test(hash)
    );
    if (validHashes.length !== commitHashesForFsPath.length) {
      throw new RangeError(`Got invalid hashes for ${fileFsPath}`);
    }

    // TODO: Validate output
    const relativeFsPathLists = await Promise.all(
      validHashes.map((hash) =>
        execGit(`diff-tree --no-commit-id --name-only -r ${hash}`, {
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
