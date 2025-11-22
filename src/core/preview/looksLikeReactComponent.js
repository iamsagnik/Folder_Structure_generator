const vscode = require("vscode");

async function looksLikeReactComponent(absPath) {
    try {
        const rawBytes = await vscode.workspace.fs.readFile(vscode.Uri.file(absPath));
        let raw = Buffer.from(rawBytes).toString("utf8");
        return (
            /export default function/i.test(raw) ||
            /export default\s+.*=>\s*\(/i.test(raw) ||
            (/const\s+\w+\s*=\s*\(/i.test(raw) && /return\s*\(/i.test(raw))
        );
    } catch {
        return false;
    }
}

module.exports = {
  looksLikeReactComponent 
};