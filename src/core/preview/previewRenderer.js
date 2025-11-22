const vscode = require("vscode");
const path = require("path");
const { injectVariables } = require("..variables/injectVariables.js");
const { collectVariablesFromTree } = require("..variables/collectVariablesFromTree.js");
const { buildIgnoreMatchers } = require("..ignore/buildIgnoreMatchers.js");

async function previewSgmtr(uri) {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(raw).toString("utf8");
        const data = JSON.parse(text);

        const choice = await vscode.window.showQuickPick(
            ["Show imports/exports", "Hide imports/exports"],
            { placeHolder: "Preview mode" }
        );
        const showDetails = choice === "Show imports/exports";

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";

        const allVars = collectVariablesFromTree(data);
        const values = {};

        for (const v of allVars) {
            if (v === "workspaceName"){ 
                values[v] = path.basename(workspaceRoot); 
                continue; 
            }
            if (v === "date"){ 
                values[v] = new Date().toISOString().split("T")[0]; 
                continue; 
            }
            if (v === "time"){ 
                values[v] = new Date().toISOString().split("T")[1].split(".")[0]; 
                continue; 
            }
            if (v.startsWith("ask:")) { 
                values[v] = `<${v.slice(4)}>`; 
                continue; 
            }
            values[v] = "";
        }

        const patterns = await loadSgmtrIgnore(workspaceRoot);
        const matchers = buildIgnoreMatchers(patterns);

        async function enhanceTree(node, absBase) {
            if (!node || typeof node !== "object") return {};

            const enhanced = {};

            for (const rawKey of Object.keys(node)) {
                const key = injectVariables(rawKey, values);
                const value = node[rawKey];
                const absPath = path.join(absBase, key);
                const relPath = path.relative(workspaceRoot, absPath);

                if (isIgnored(relPath, matchers)) continue;

                if (typeof value === "string") {

                    const resolvedContent = injectVariables(value, values);
                    const ext = path.extname(key);
                    const isSnippet = isReactSnippetKeyword(resolvedContent);
                    const couldBeComponent = [".jsx", ".tsx"].includes(ext);

                    if (showDetails && (isSnippet || couldBeComponent)) {

                        const isRealComponent =
                            couldBeComponent ? await looksLikeReactComponent(absPath) : false;

                        const label = isSnippet
                            ? `${key} [expands: ${resolvedContent}]`
                            : (isRealComponent
                                ? `${key} [component detected]`
                                : key);
                        const meta = await extractImportsExports(absPath);

                        const importArr = meta.imports.length
                            ? meta.imports.map(line => `- ${line.trim()}`)
                            : ["(none)"];

                        const exportArr = meta.exports.length
                            ? meta.exports.map(line => `- ${line.trim()}`)
                            : ["(none)"];

                        enhanced[label] = {
                            imports: importArr,
                            exports: exportArr
                        };

                    } else {
                        enhanced[key] = "(file)";
                    }

                    continue;
                }

                if (typeof value === "object" && value !== null) {
                    enhanced[key] = await enhanceTree(value, absPath);
                    continue;
                }
                enhanced[key] = "(file)";
            }

            return enhanced;
        }

        // Build tree for preview
        const enhanced = await enhanceTree(data, workspaceRoot);
        const tree = buildAsciiTree(enhanced);

        const panel = vscode.window.createWebviewPanel(
            "sgmtrPreview",
            "SGMTR Preview",
            vscode.ViewColumn.Beside,
            {}
        );

        panel.webview.html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
    body {
        font-family: monospace;
        padding: 20px;
        white-space: pre;
    }
</style>
</head>
<body>
<h3>Preview – Folder Structure</h3>
${tree}
</body>
</html>`;
    }

    catch (err) {
        vscode.window.showErrorMessage("Preview Error: " + err.message);
    }
}

module.exports = { 
  previewSgmtr 
};