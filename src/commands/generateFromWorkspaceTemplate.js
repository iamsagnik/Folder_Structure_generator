const vscode = require("vscode");
const path = require("path");
const { createTreeWithVars } = require("../core/generator/createTreeWithVars");
const { collectVariablesFromTree } = require("../core/variables/collectVariablesFromTree");
const { loadWorkspaceTemplates } = require("../core/templates/loadWorkspaceTemplates");


async function generateFromWorkspaceTemplate(uri) {
    const workspace = vscode.workspace.workspaceFolders?.[0];
    if (!workspace) {
        return vscode.window.showErrorMessage("Open a workspace first.");
    }

    const workspaceRoot = workspace.uri.fsPath;
    const templates = await loadWorkspaceTemplates(workspaceRoot);

    if (templates.length === 0) {
        return vscode.window.showErrorMessage("No templates found in .sgmtr/templates/");
    }

    const picked = await vscode.window.showQuickPick(
        templates.map(t => t.label),
        { placeHolder: "Select a workspace template" }
    );

    if (!picked) return;

    const template = templates.find(t => t.label === picked);

    const rawBytes = await vscode.workspace.fs.readFile(vscode.Uri.file(template.filePath));
    const raw = Buffer.from(rawBytes).toString("utf8");
    const data = JSON.parse(raw);

    // Collect variables
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
            const val = await vscode.window.showInputBox({ prompt: question });
            values[v] = val || "";
            continue;
        }
        values[v] = "";
    }

    await createTreeWithVars(uri || workspace.uri, data, values);

    vscode.window.showInformationMessage(`Template "${picked}" generated successfully.`);
}

module.exports = {
  generateFromWorkspaceTemplate
};