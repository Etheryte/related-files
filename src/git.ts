import * as vscode from "vscode";
import * as path from "path";
import * as shelljs from "shelljs";

let git = "git";
try {
  // See https://github.com/Sertion/vscode-gitblame/blob/master/src/git/util/gitcommand.ts#L13
  const vscodeGit = vscode.extensions.getExtension("vscode.git");
  if (vscodeGit?.exports.enabled) {
    git = vscodeGit.exports.getAPI(1).git.path || git;
  }
} catch (_) {}

// See https://gist.github.com/davidrleonard/2962a3c40497d93c422d1269bcd38c8f
function exec(
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
        return resolve((stdout || "").trim().split(/\r?\n/));
      }
    );
  });
}

/** Get relative paths of files that have been committed together with a given file, include duplicates */
export default async function getRelatedFilesFor(
  workspaceUri: vscode.Uri,
  fileUri: vscode.Uri
) {
  const fileFsPath = path.resolve(workspaceUri.fsPath, fileUri.fsPath);
  return exec(
    // See https://stackoverflow.com/a/42528210/1470607
    // This returns non-zero if we're not in a repository so we don't need to check for that separately
    `${git} log --follow --format=%H -- ${fileFsPath} | xargs ${git} show --format="" --name-only`,
    {
      cwd: workspaceUri.fsPath,
    }
  );
}
