const path = require("path");
const vscode = require("vscode");
const { createTreeWithVars } = require("../core/generator/createTreeWithVars");
const { collectVariablesFromTree } = require("../core/variables/collectVariablesFromTree");

async function generateFromSgmtr(uri) {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = raw.toString();
        const data = JSON.parse(text);

        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) {
            return vscode.window.showErrorMessage("Open a workspace folder first.");
        }

        const allVars = collectVariablesFromTree(data);
        const values = {};

        for (const v of allVars) {
            if (v === "workspaceName") {
                values[v] = workspace.name;
                continue;
            }

            if (v === "date") {
                values[v] = new Date().toISOString().split("T")[0];
                continue;
            }

            if (v === "time") {
                values[v] = new Date().toISOString().split("T")[1].split(".")[0];
                continue;
            }

            if (v.startsWith("ask:")) {
                const question = v.slice(4);
                const userValue = await vscode.window.showInputBox({
                    prompt: question,
                    validateInput: val => val.trim() === "" ? "Value required" : null
                });
                values[v] = userValue || "";
                continue;
            }
            // Unhandled vars → set empty
            values[v] = "";
        }

        // TREE GENERATION 
        await createTreeWithVars(workspace.uri, data, values);
        vscode.window.showInformationMessage("Folder structure generated successfully with variables.");

    } catch (err) {
        vscode.window.showErrorMessage("Generation Error: " + err.message);
    }
}

module.exports = {
  generateFromSgmtr 
};