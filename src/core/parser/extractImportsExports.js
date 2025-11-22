
async function extractImportsExports(abs) {
    try {
        const rawBytes = await vscode.workspace.fs.readFile(vscode.Uri.file(abs));
        const raw = Buffer.from(rawBytes).toString("utf8");
        const lines = raw.split("\n");
        const imports = lines.filter(l => l.trim().startsWith("import"));
        const exports = lines.filter(l => l.trim().startsWith("export"));

        return { imports, exports };
    } catch {
        return { imports: [], exports: [] };
    }
}

module.exports = { 
  extractImportsExports 
};