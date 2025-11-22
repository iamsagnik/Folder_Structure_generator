
async function reverseGenerate(uri) {

    vscode.window.showInformationMessage("reverseGenerate triggered");
    if (!uri) {
        vscode.window.showErrorMessage("No folder selected.");
        return;
    }

    try {
        const folderPath = uri.fsPath;
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || folderPath;

        const patterns = await loadSgmtrIgnore(workspaceRoot);
        const matchers = buildIgnoreMatchers(patterns);

        const tree = await readFolder(folderPath, folderPath, matchers);

        const json = JSON.stringify(tree, null, 2);
        const fileName = path.basename(folderPath) + ".sgmtr";
        const outPath = vscode.Uri.file(path.join(folderPath, fileName));

        await vscode.workspace.fs.writeFile(outPath, Buffer.from(json, "utf8"));

        vscode.window.showInformationMessage(`Generated: ${fileName}`);
    } catch (err) {
        vscode.window.showErrorMessage("Reverse Generation Error: " + err.message);
    }
}

module.exports = { 
  reverseGenerate 
};