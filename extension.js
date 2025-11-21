import {buildAsciiTree} from "./treeStyler.js";
import path from "path";
import fs from "fs";
import { Minimatch } from "minimatch";
import { expandReactSnippet, isReactSnippetKeyword } from "./snippets/reactSnippets.js";
import * as vscode from "vscode";

// Check if file exists
async function fileExists(uri) {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

// Detect snippet keyword from raw file content
function detectSnippet(raw) {
    const trimmed = raw.trim();
    const keywords = ["rafce", "rfc", "rafc", "rsc", "rcc"];

    if (keywords.includes(trimmed)) return trimmed;

    if (/export default\s+.*=>\s*\(/i.test(raw)) return "rafce";
    if (/export default function/i.test(raw)) return "rfc";
    if (/const\s+\w+\s*=\s*\(/i.test(raw) && /return\s*\(/i.test(raw)) return "rafc";

    return null;
}

// Detect React component in real files during preview
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

// For reverse generation – produce clean DSL value
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

// Extract imports and exports from real file
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

// PREVIEW
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

        const patterns = loadSgmtrIgnore(workspaceRoot);
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

                        const importObj = meta.imports.length
                            ? Object.fromEntries(meta.imports.map(line => [`- ${line}`, "{imports}"]))
                            : { "(none)": "(none)" };

                        const exportObj = meta.exports.length
                            ? Object.fromEntries(meta.exports.map(line => [`- ${line}`, "{export}"]))
                            : { "(none)": "(none)" };

                        enhanced[label] = {
                            imports: importObj,
                            exports: exportObj
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

// GENERATE
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

// IGNORE FILE SUPPORT
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

// IGNORE FILE SUPPORT
function buildIgnoreMatchers(patterns) {
    const includes = [];
    const excludes = [];

    for (let p of patterns) {

        // AUTO-EXPAND: "folder/**" → ["folder", "folder/**"]
        if (p.endsWith("/**")) {
            const base = p.slice(0, -3); // remove "/**"
            excludes.push(new Minimatch(base, { matchBase: true }));
            excludes.push(new Minimatch(p, { matchBase: true }));
            continue;
        }

        // Negation (!pattern)
        if (p.startsWith("!")) {
            includes.push(new Minimatch(p.slice(1), { matchBase: true }));
        } else {
            excludes.push(new Minimatch(p, { matchBase: true }));
        }
    }

    return { includes, excludes };
}

// IGNORE FILE
function isIgnored(relativePath, matchers) {
    const { includes, excludes } = matchers;

    for (const mm of excludes) if (mm.match(relativePath)) return true;
    for (const mm of includes) if (mm.match(relativePath)) return false;

    return false;
}

// REVERSE GENERATION
async function readFolder(folderPath, basePath, matchers) {
    const tree = {};

    const folderUri = vscode.Uri.file(folderPath);
    let entries;
    try {
        entries = await vscode.workspace.fs.readDirectory(folderUri);
        // entries: [ [name, vscode.FileType.File], [name, vscode.FileType.Directory] ]
    } catch {
        return tree;
    }

    for (const [name, type] of entries) {
        const abs = path.join(folderPath, name);
        const rel = path.relative(basePath, abs);

        if (isIgnored(rel, matchers)) continue;

        if (type === vscode.FileType.Directory) {
            tree[name] = await readFolder(abs, basePath, matchers);
        } else if (type === vscode.FileType.File) {
            tree[name] = await processFileContent(abs);
        }
    }

    return tree;
}

// REVERSE GENERATION
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

// Variable Handling 
function collectVariablesFromTree(node, set = new Set()) {
    if (!node || typeof node !== "object") return set;

    for (const key of Object.keys(node)) {
        extractVariablesFromString(key, set);
        const value = node[key];
        if (typeof value === "string") extractVariablesFromString(value, set);
        else if (typeof value === "object") collectVariablesFromTree(value, set);
    }
    return Array.from(set);
}

function extractVariablesFromString(str, set) {
    const regex = /\$\{([^}]+)\}/g;
    let match;
    while ((match = regex.exec(str))) set.add(match[1]);
}

function injectVariables(str, values) {
    return str.replace(/\$\{([^}]+)\}/g, (_, name) => values[name] || "");
}

// GENERATION WITH VARIABLES
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

export {
    activate,
    deactivate
};