import * as vscode from "vscode";

// Fetch default values from package.json to avoid out-of-sync issues
const pkg = require("../package.json");

const properties = pkg.contributes.configuration.properties;
const defaultIgnoreGlobs = properties["relatedFiles.ignoreGlobs"].default;
const defaultMaxCount = properties["relatedFiles.maxCount"].default;

export default {
  getIgnoreGlobs(): string[] {
    const value = vscode.workspace
      .getConfiguration("relatedFiles")
      .get<string>("ignoreGlobs");
    if (typeof value === "undefined") {
      return defaultIgnoreGlobs;
    }
    return value.split(",").map((entry) => (entry || "").trim());
  },
  getMaxCount(): number {
    const value = vscode.workspace
      .getConfiguration("relatedFiles")
      .get<number>("maxCount");
    if (typeof value === "undefined") {
      return defaultMaxCount;
    }
    return value;
  },
};
