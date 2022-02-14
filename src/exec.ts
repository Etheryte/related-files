import * as shelljs from "shelljs";

// See https://gist.github.com/davidrleonard/2962a3c40497d93c422d1269bcd38c8f
export default function exec(
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
