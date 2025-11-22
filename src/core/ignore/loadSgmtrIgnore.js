const vscode = require('vscode');
const path = require('path');

async function loadSgmtrIgnore(rootPath) {

    const ignoreUri = vscode.Uri.file(path.join(rootPath, '.sgmtrignore'));

    try {
        const rawBytes = await vscode.workspace.fs.readFile(ignoreUri);
        const raw = Buffer.from(rawBytes).toString("utf8");

        return raw
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));

    } catch {
        return [];
    }
}

module.exports = {
  loadSgmtrIgnore 
};