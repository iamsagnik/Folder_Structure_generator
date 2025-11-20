import {buildAsciiTree} from "./treeStyler.js";
import path from "path";
import fs from "fs";
import { Minimatch } from "minimatch";
import { expandReactSnippet, isReactSnippetKeyword } from "./snippets/reactSnippets.js";
import * as vscode from "vscode";


async function fileExists(uri) {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

// Remove comments before JSON parse
function stripComments(text) {
    text = text.replace(/\/\*[\s\S]*?\*\//g, "");
    text = text.replace(/\/\/.*$/gm, "");
    return text;
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
function looksLikeReactComponent(absPath) {
    let raw;
    try {
        raw = fs.readFileSync(absPath, "utf8");
    } catch {
        return false;
    }

    return (
        /export default function/i.test(raw) ||
        /export default\s+.*=>\s*\(/i.test(raw) ||
        (/const\s+\w+\s*=\s*\(/i.test(raw) && /return\s*\(/i.test(raw))
    );
}

// For reverse generation – produce clean DSL value
function processFileContent(abs) {
    let raw;
    try {
        raw = fs.readFileSync(abs, 'utf8');
    } catch {
        return "";
    }

    const snippet = detectSnippet(raw);
    if (snippet) return snippet;

    return "";
}

// Generate folders/files from DSL
async function createTree(baseUri, node) {
    for (const key of Object.keys(node)) {
        let value = node[key];
        const targetUri = vscode.Uri.joinPath(baseUri, key);

        if (typeof value === "string") {
            const ext = path.extname(key);

            if ((ext === ".jsx" || ext === ".tsx") && isReactSnippetKeyword(value)) {
                value = expandReactSnippet(value, key);
            }

            const parentDir = path.dirname(targetUri.fsPath);
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(parentDir));

            if (await fileExists(targetUri)) {
                const choice = await vscode.window.showQuickPick(
                    ["Overwrite", "Skip"],
                    { placeHolder: `File "${key}" already exists. Overwrite?` }
                );

                if (choice !== "Overwrite") continue;
            }

            await vscode.workspace.fs.writeFile(targetUri, Buffer.from(value, "utf8"));

        } else if (typeof value === "object") {
            await vscode.workspace.fs.createDirectory(targetUri);
            await createTree(targetUri, value);
        }
    }
}

// Extract imports and exports from real file
function extractImportsExports(abs) {
    let raw;
    try {
        raw = fs.readFileSync(abs, "utf8");
    } catch {
        return { imports: [], exports: [] };
    }

    const lines = raw.split("\n");
    const imports = lines.filter(l => l.trim().startsWith("import"));
    const exports = lines.filter(l => l.trim().startsWith("export"));

    return { imports, exports };
}

// PREVIEW
async function previewSgmtr(uri) {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = stripComments(raw.toString());
        const data = JSON.parse(text);

        const choice = await vscode.window.showQuickPick(
            ["Show imports/exports", "Hide imports/exports"],
            { placeHolder: "Preview mode" }
        );
        const showDetails = choice === "Show imports/exports";

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        // Load ignore patterns
        const patterns = loadSgmtrIgnore(workspaceRoot);
        const matchers = buildIgnoreMatchers(patterns);

        // ---------------------------------------------------------
        // TREE BUILDER (with ignore + JSON path tracking)
        // ---------------------------------------------------------
        function enhanceTree(node, absBase, matchers, jsonPath = "") {

            if (!node || typeof node !== "object") return {};

            const enhanced = {};

            for (const key of Object.keys(node)) {
                const value = node[key];
                const absPath = path.join(absBase, key);

                // JSON path, e.g. "src/components/ui/Button.jsx"
                const currentJsonPath = jsonPath ? `${jsonPath}/${key}` : key;

                // IGNORE CHECK (JSON path based)
                if (isIgnored(currentJsonPath, matchers)) continue;

                // ------------------- FILE -------------------
                if (typeof value === "string") {
                    const isSnippet = isReactSnippetKeyword(value);
                    const isComponent = looksLikeReactComponent(absPath);

                    // Detailed preview of imports/exports
                    if (showDetails && (isSnippet || isComponent)) {
                        const meta = extractImportsExports(absPath) || {};
                        const importsArr = Array.isArray(meta.imports) ? meta.imports : [];
                        const exportsArr = Array.isArray(meta.exports) ? meta.exports : [];

                        const label = isSnippet
                            ? `${key} [expands: ${value}]`
                            : `${key} [component detected]`;

                        const importObj = importsArr.length
                            ? Object.fromEntries(
                                  importsArr.map(line => [`- ${line}`, "(import)"])
                              )
                            : { "(none)": "(none)" };

                        const exportObj = exportsArr.length
                            ? Object.fromEntries(
                                  exportsArr.map(line => [`- ${line}`, "(export)"])
                              )
                            : { "(none)": "(none)" };

                        enhanced[label] = {
                            imports: importObj,
                            exports: exportObj
                        };

                    } else {
                        // Simple file preview (leaf)
                        enhanced[key] = "(file)";
                    }

                    continue;
                }

                // ------------------- FOLDER -------------------
                if (typeof value === "object" && value !== null) {
                    enhanced[key] = enhanceTree(value, absPath, matchers, currentJsonPath);
                    continue;
                }

                // ------------------- FALLBACK -------------------
                enhanced[key] = "(file)";
            }

            return enhanced;
        }

        // Build preview tree
        const enhanced = enhanceTree(data, workspaceRoot, matchers);
        const tree = buildAsciiTree(enhanced);

        // ---------------------------------------------------------
        // WEBVIEW HTML
        // ---------------------------------------------------------
        const panel = vscode.window.createWebviewPanel(
            "sgmtrPreview",
            "SGMTR Preview",
            vscode.ViewColumn.Beside,
            {}
        );

        panel.webview.html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
    body {
        font-family: monospace;
        padding: 20px;
        white-space: pre;
    }
    h3 { margin-top: 0; }
</style>
</head>
<body>
<h3>Preview – Folder Structure</h3>
${tree}
</body>
</html>`;
    } catch (err) {
        vscode.window.showErrorMessage("Preview Error: " + err.message);
    }
}


// GENERATE
async function generateFromSgmtr(uri) {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = stripComments(raw.toString());
        const data = JSON.parse(text);

        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) {
            return vscode.window.showErrorMessage("Open a workspace folder first.");
        }

        await createTree(workspace.uri, data);

        vscode.window.showInformationMessage("Folder structure generated successfully.");
    } catch (err) {
        vscode.window.showErrorMessage("Generation Error: " + err.message);
    }
}

// IGNORE FILE SUPPORT
function loadSgmtrIgnore(rootPath) {
    const ignoreFile = path.join(rootPath, '.sgmtrignore');
    if (!fs.existsSync(ignoreFile)) return [];

    const raw = fs.readFileSync(ignoreFile, 'utf8');
    const lines = raw.split(/\r?\n/);

    return lines
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
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
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });

    for (const entry of entries) {
        const abs = path.join(folderPath, entry.name);
        const rel = path.relative(basePath, abs);

        if (isIgnored(rel, matchers)) continue;

        if (entry.isDirectory()) {
            const childTree = await readFolder(abs, basePath, matchers);
            tree[entry.name] = childTree;
        } else if (entry.isFile()) {
            tree[entry.name] = processFileContent(abs);
        }
    }

    return tree;
}

async function reverseGenerate(uri) {
    if (!uri) {
        vscode.window.showErrorMessage("No folder selected.");
        return;
    }

    try {
        const folderPath = uri.fsPath;
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || folderPath;

        const patterns = loadSgmtrIgnore(workspaceRoot);
        const matchers = buildIgnoreMatchers(patterns);

        const tree = await readFolder(folderPath, folderPath, matchers);

        const json = JSON.stringify(tree, null, 2);
        const fileName = path.basename(folderPath) + ".sgmtr";
        const outPath = path.join(folderPath, fileName);

        fs.writeFileSync(outPath, json, 'utf8');

        vscode.window.showInformationMessage(`Generated: ${fileName}`);
    } catch (err) {
        vscode.window.showErrorMessage("Reverse Generation Error: " + err.message);
    }
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
}

function deactivate() {}

export {
    activate,
    deactivate
};