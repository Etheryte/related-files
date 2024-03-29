import * as vscode from "vscode";
import * as path from "path";
import { promises as fs } from "fs";
import * as micromatch from "micromatch";

import RelatedFile from "./relatedFile";
import Cache from "./cache";
import getRelatedFilesFor from "./git";
import configuration from "./configuration";

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

  updateView(): void {
    // Update the tree view
    this._onDidChangeTreeData.fire();

    // TODO: Do this only after `getChildren()` and automatically update the current file's cache if we have it
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
      console.error(error);
      return [];
    }
  }

  async preloadCacheFor(
    workspaceUri: vscode.Uri,
    fileUri: vscode.Uri
  ): Promise<void> {
    try {
      await this._getCachedRelatedFilesFor(workspaceUri, fileUri);
    } catch (error) {
      console.error(error);
    }
  }

  clearCache() {
    this._cache.clear();
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
    const relativeFsPaths = await getRelatedFilesFor(workspaceUri, fileUri);

    const workspaceFsPath = workspaceUri.fsPath;
    const fileFsPath = path.resolve(workspaceFsPath, fileUri.fsPath);

    // Figure out how many times each related file was committed along with this one
    const fullFsPaths = new Set<string>();
    const fullFsPathCounts = new Map<string, number>();
    for (let ii = 0; ii < relativeFsPaths.length; ii++) {
      const fileName = relativeFsPaths[ii];
      // This shouldn't happen, but just to be sure
      if (!fileName) {
        throw new TypeError("Received no file name");
      }
      const fullFsPath = path.resolve(workspaceFsPath, fileName);

      // Exclude the open file itself
      if (fullFsPath === fileFsPath) {
        continue;
      }
      fullFsPaths.add(fullFsPath);
      fullFsPathCounts.set(
        fullFsPath,
        (fullFsPathCounts.get(fullFsPath) ?? 0) + 1
      );
    }

    const ignoreGlobs = configuration.getIgnoreGlobs();
    const maxCount = configuration.getMaxCount();
    const validFsPaths = (
      await Promise.all(
        Array.from(fullFsPaths).map(async (fullFsPath) => {
          try {
            // Check whether the files still exist
            await fs.stat(fullFsPath);
            // Check whether the path matches any ignore globs
            if (micromatch.isMatch(fullFsPath, ignoreGlobs)) {
              return undefined;
            }
            return fullFsPath;
          } catch {
            // Ignore the path
            return undefined;
          }
        })
      )
    ).filter((result) => typeof result !== "undefined") as string[];

    return validFsPaths
      .sort(
        (a, b) =>
          // Sort primarily by commit count
          (fullFsPathCounts.get(b) ?? 0) - (fullFsPathCounts.get(a) ?? 0) ||
          // And then alphabetically
          b.localeCompare(a)
      )
      .slice(0, maxCount)
      .map(
        (fullFsPath) =>
          new RelatedFile(fullFsPath, fullFsPathCounts.get(fullFsPath))
      );
  }
}
