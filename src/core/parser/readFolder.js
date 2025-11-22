
async function readFolder(folderPath, basePath, matchers) {
    const tree = {};

    const folderUri = vscode.Uri.file(folderPath);
    let entries;
    try {
        entries = await vscode.workspace.fs.readDirectory(folderUri);
        // entries: [ [name, vscode.FileType.File], [name, vscode.FileType.Directory] ]
    } catch {
        return tree;
    }

    for (const [name, type] of entries) {
        const abs = path.join(folderPath, name);
        const rel = path.relative(basePath, abs);

        if (isIgnored(rel, matchers)) continue;

        if (type === vscode.FileType.Directory) {
            tree[name] = await readFolder(abs, basePath, matchers);
        } else if (type === vscode.FileType.File) {
            tree[name] = await processFileContent(abs);
        }
    }

    return tree;
}

module.exports = { 
  readFolder 
};