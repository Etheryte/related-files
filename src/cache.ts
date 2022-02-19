import * as vscode from "vscode";
import * as path from "path";

import RelatedFile from "./relatedFile";

const MAX_CACHE_AGE = 5; // minutes
const ONE_MINUTE = 1000 * 60; // ms

type CacheItem = {
  entry: Promise<RelatedFile[]>;
  entryTime: ReturnType<Date["valueOf"]>;
};

export default class Cache {
  /** A map from a workspace fsPath to a map of a file's fsPath to related files */
  private _state = new Map<
    string,
    Map<string, CacheItem | undefined> | undefined
  >();
  private _lastClear: ReturnType<Date["valueOf"]> | undefined;

  /** Get a cache item for a file in a workspace */
  get(
    workspaceUri: vscode.Uri,
    fileUri: vscode.Uri
  ): Promise<RelatedFile[]> | undefined {
    const workspaceFsPath = workspaceUri.fsPath;
    const fileFsPath = path.resolve(workspaceFsPath, fileUri.fsPath);
    return this._state.get(workspaceFsPath)?.get(fileFsPath)?.entry;
  }

  /** Set a cache item for a file in a workspace */
  set(
    workspaceUri: vscode.Uri,
    fileUri: vscode.Uri,
    entry: Promise<RelatedFile[]>
  ): void {
    const workspaceFsPath = workspaceUri.fsPath;
    const fileFsPath = path.resolve(workspaceFsPath, fileUri.fsPath);
    let workspaceCache = this._state.get(workspaceFsPath);
    if (!workspaceCache) {
      workspaceCache = new Map();
      this._state.set(workspaceFsPath, workspaceCache);
    }
    const cacheEntry = {
      entry,
      entryTime: new Date().valueOf(),
    };
    workspaceCache.set(fileFsPath, cacheEntry);
  }

  /** Clear the cache for a file in a workspace, or for a full workspace if only that is provided */
  delete(workspaceUri: vscode.Uri, fileUri?: vscode.Uri): void {
    const workspaceFsPath = workspaceUri.fsPath;
    if (typeof fileUri === "undefined") {
      // Clear the whole workspace, if applicable
      this._state.delete(workspaceFsPath);
    } else {
      // Clear only the file, if applicable
      const fileFsPath = path.resolve(workspaceFsPath, fileUri.fsPath);
      this._state.get(workspaceFsPath)?.delete(fileFsPath);
    }
  }

  async clearOldEntries() {
    // Throttle clears to once a minute at most
    const now = new Date().valueOf();
    if (this._lastClear && now - this._lastClear < ONE_MINUTE) {
      return;
    }
    this._lastClear = new Date().valueOf();

    for (const [workspaceFsPath, workspaceCache] of this._state.entries()) {
      for (const [fileFsPath, cacheEntry] of this._state
        .get(workspaceFsPath)
        ?.entries() || []) {
        if (
          // This should never happen but just in case there's no sanity
          !cacheEntry ||
          // Or if the cache item is old
          now - cacheEntry.entryTime > MAX_CACHE_AGE * ONE_MINUTE
        ) {
          this._state.get(workspaceFsPath)?.delete(fileFsPath);
        }
      }
      // If nothing remains in the workspace cache, delete it too
      if (!workspaceCache?.size) {
        this._state.delete(workspaceFsPath);
      }
    }
  }
}
