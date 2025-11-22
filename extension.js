const { buildAsciiTree } = require("./treeStyler.js");
const path = require("path");
const { Minimatch } = require("minimatch");
const { expandReactSnippet, isReactSnippetKeyword } = require("./snippets/reactSnippets.js");
const vscode = require("vscode");

// Check if file exists
async function fileExists(uri) {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

// Generate folders/files from DSL
async function createTree(baseUri, node, values) {
    for (const rawKey of Object.keys(node)) {

        // Inject variables into folder/file name
        const key = injectVariables(rawKey, values);
        const rawValue = node[rawKey];

        const targetUri = vscode.Uri.joinPath(baseUri, key);

        // ---------------- FILE ----------------
        if (typeof rawValue === "string") {
            let content = injectVariables(rawValue, values);

            // Expand snippet after variable injection
            const ext = path.extname(key);
            if ((ext === ".jsx" || ext === ".tsx") && isReactSnippetKeyword(content)) {
                content = expandReactSnippet(content, key);
            }

            const parentDir = path.dirname(targetUri.fsPath);
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(parentDir));

            await vscode.workspace.fs.writeFile(targetUri, Buffer.from(content, "utf8"));
            continue;
        }

        // ---------------- FOLDER ----------------
        if (typeof rawValue === "object" && rawValue !== null) {
            await vscode.workspace.fs.createDirectory(targetUri);
            await createTree(targetUri, rawValue, values);
        }
    }
}

// GENERATE


// IGNORE FILE
function isIgnored(relativePath, matchers) {
    const { includes, excludes } = matchers;

    for (const mm of excludes) if (mm.match(relativePath)) return true;
    for (const mm of includes) if (mm.match(relativePath)) return false;

    return false;
}


// GENERATION WITH VARIABLES


// LOAD WORKSPACE TEMPLATES
async function loadWorkspaceTemplates(workspaceRoot) {
    const dirPath = path.join(workspaceRoot, ".sgmtr", "templates");
    const dirUri = vscode.Uri.file(dirPath);

    let entries;

    // Check directory exists
    try {
        entries = await vscode.workspace.fs.readDirectory(dirUri);
    } catch {
        return [];
    }

    // entries = [ ["fileName", FileType] ]
    const templates = entries
        .filter(([name, type]) => type === vscode.FileType.File && name.endsWith(".sgmtr"))
        .map(([name]) => ({
            label: name.replace(".sgmtr", ""),
            filePath: path.join(dirPath, name)
        }));

    return templates;
}

// GENERATION WITH WORKSPACE TEMPLATE


// ACTIVATE
function activate(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "folderStructureGenerator.previewSgmtr",
            (uri) => previewSgmtr(uri)
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "folderStructureGenerator.generateFromSgmtr",
            (uri) => generateFromSgmtr(uri)
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'folderGen.reverseGenerate',
            (uri) => reverseGenerate(uri)
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "folderStructureGenerator.generateFromWorkspaceTemplate",
            (uri) => generateFromWorkspaceTemplate(uri)
        )
    );
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
