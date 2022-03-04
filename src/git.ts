import * as vscode from "vscode";
import * as path from "path";
import * as shelljs from "shelljs";
import { FSWatcher, promises as fs, unwatchFile, watch, watchFile } from "fs";

let git = "git";
try {
  // See https://github.com/Sertion/vscode-gitblame/blob/master/src/git/util/gitcommand.ts#L13
  const vscodeGit = vscode.extensions.getExtension("vscode.git");
  if (vscodeGit?.exports.enabled) {
    git = vscodeGit.exports.getAPI(1).git.path || git;
  }
} catch (_) {}

// See https://gist.github.com/davidrleonard/2962a3c40497d93c422d1269bcd38c8f
function filteredExec(
  command: string,
  options: Omit<shelljs.ExecOptions, "async">
): Promise<string[]> {
  return new Promise(function (resolve, reject) {
    const baseOptions: shelljs.ExecOptions = { async: true, silent: true };
    shelljs.exec(
      command,
      Object.assign(baseOptions, options),
      function (code, stdout, stderr) {
        if (code !== 0) return reject(new Error(stderr));
        const result = (stdout || "").trim().split(/\r?\n/);
        const noEmptyLines = result.filter(Boolean);
        return resolve(noEmptyLines);
      }
    );
  });
}

// TODO: Is there a better way to implement this?
export async function onBranchChange(
  workspaceUri: vscode.Uri,
  callback: () => void
) {
  const head = path.resolve(workspaceUri.fsPath, "./.git/HEAD");
  let watcher: FSWatcher | undefined;
  try {
    // Ensure the file exists
    await fs.stat(head);
    // TODO: Investigate why `fs.watch()` doesn't seem to figure out HEAD changes
    watchFile(head, callback);
  } catch (error) {
    console.error(error);
  }

  return function destroyListener() {
    unwatchFile(head, callback);
  };
}

/** Get relative paths of files that have been committed together with a given file, include duplicates */
export default async function getRelatedFilesFor(
  workspaceUri: vscode.Uri,
  fileUri: vscode.Uri
) {
  const fileFsPath = path.resolve(workspaceUri.fsPath, fileUri.fsPath);
  return filteredExec(
    // See https://stackoverflow.com/a/42528210/1470607
    // This returns non-zero if we're not in a repository so we don't need to check for that separately
    // NB! The `git log --follow` flag makes git log incredibly slow compared to non-follow, so we're using a simple `git rev-list` instead
    `${git} rev-list HEAD -- ${fileFsPath} | xargs ${git} show --format="" --name-only`,
    {
      cwd: workspaceUri.fsPath,
    }
  );
}
