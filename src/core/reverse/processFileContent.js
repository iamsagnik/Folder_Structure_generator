
async function processFileContent(abs) {
    try {
        const rawBytes = await vscode.workspace.fs.readFile(vscode.Uri.file(abs));
        const raw = Buffer.from(rawBytes).toString("utf8");
        const snippet = detectSnippet(raw);
        return snippet || "";
    } catch {
        return "";
    }
}

module.exports = {
  processFileContent
};