import * as vscode from "vscode";
import * as path from "path";

// TODO: If the label matches the open file label (multiple files with same name), show a longer path
export default class RelatedFile extends vscode.TreeItem {
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
