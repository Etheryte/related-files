import * as vscode from "vscode";
import * as shelljs from "shelljs";

let gitCommand = "git";
try {
  /**
   * Source: https://github.com/Sertion/vscode-gitblame/blob/master/src/git/util/gitcommand.ts#L13
   * License: MIT
   */
  const vscodeGit = vscode.extensions.getExtension("vscode.git");
  if (vscodeGit?.exports.enabled) {
    gitCommand = vscodeGit.exports.getAPI(1).git.path || gitCommand;
  }
} catch (_) {}

// See https://gist.github.com/davidrleonard/2962a3c40497d93c422d1269bcd38c8f
export default function execGit(
  command: string,
  options: Omit<shelljs.ExecOptions, "async">
): Promise<string[]> {
  return new Promise(function (resolve, reject) {
    const baseOptions: shelljs.ExecOptions = { async: true, silent: true };
    shelljs.exec(
      `${gitCommand} ${command}`,
      Object.assign(baseOptions, options),
      function (code, stdout, stderr) {
        if (code !== 0) return reject(new Error(stderr));
        return resolve((stdout || "").trim().split(/\r?\n/));
      }
    );
  });
}
