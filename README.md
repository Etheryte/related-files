# Related Files

Related Files is a Visual Studio Code extension that adds a sidebar panel listing files related to the currently open file based on its Git history.

Files committed together more often are listed first.

![Sample view of the sidebar](/assets/both.png)

## Configuration

The following configuration options are available:

| Option                     | Default value                        | Description                                   |
| -------------------------- | ------------------------------------ | --------------------------------------------- |
| `relatedFiles.ignoreGlobs` | `**/package-lock.json, **/yarn.lock` | Comma-separated list of path globs to ignore. |
| `relatedFiles.maxCount`    | 25                                   | The maximum number of related files to list.  |
