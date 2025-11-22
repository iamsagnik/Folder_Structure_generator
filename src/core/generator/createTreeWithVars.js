const path = require("path");
const vscode = require("vscode");

async function createTreeWithVars(baseUri, node, values) {
for (let rawKey of Object.keys(node)) {
        const rawValue = node[rawKey];
        const key = injectVariables(rawKey, values);
        const targetUri = vscode.Uri.joinPath(baseUri, key);

        if (typeof rawValue === "string") {
            let content = injectVariables(rawValue, values);

            const ext = path.extname(key);
            if ((ext === ".jsx" || ext === ".tsx") && isReactSnippetKeyword(content)) {
                content = expandReactSnippet(content, key);
            }

            const parentDir = path.dirname(targetUri.fsPath);
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(parentDir));

            if (await fileExists(targetUri)) {
                const choice = await vscode.window.showQuickPick(
                    ["Overwrite", "Skip"],
                    { placeHolder: `File "${key}" already exists. What do you want to do?` }
                );

                if (choice !== "Overwrite") continue;
            }

            await vscode.workspace.fs.writeFile(
                targetUri,
                Buffer.from(content, "utf8")
            );

        } else if (typeof rawValue === "object") {
            await vscode.workspace.fs.createDirectory(targetUri);
            await createTreeWithVars(targetUri, rawValue, values);
        }
    }
}

module.exports = { 
  createTreeWithVars 
};