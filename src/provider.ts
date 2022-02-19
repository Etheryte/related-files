import * as vscode from "vscode";
import * as path from "path";
import { promises as fs } from "fs";

import RelatedFile from "./relatedFile";
import Cache from "./cache";
import getRelatedFilesFor from "./git";

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

    const relativeFsPaths = await getRelatedFilesFor(workspaceUri, fileUri);
    // Figure out how many times each related file was committed along with this one
    const fullFsPaths = new Set<string>();
    const fullFsPathCounts = new Map<string, number>();
    for await (const fileName of relativeFsPaths.flat()) {
      const fullFsPath = path.resolve(workspaceFsPath, fileName);

      // Exclude the open file itself
      if (fullFsPath === fileFsPath) {
        continue;
      }

      try {
        // Check if the file currently exists
        // TODO: Check only once per path
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
          // Sort primarily by commit count
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
