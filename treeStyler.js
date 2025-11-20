import { isReactSnippetKeyword } from "./snippets/reactSnippets.js";
import path from "path";

/**
 * Build an ASCII box-drawing tree from a JSON object.
 *
 * @param {Object} node - Parsed .sgmtr structure
 * @param {string} prefix - Prefix for indentation (internal use)
 * @returns {string} Formatted ASCII tree
 */
function buildAsciiTree(node, prefix = "") {
    const entries = Object.keys(node);

    const folders = entries.filter(k => typeof node[k] === "object").sort();
    const files   = entries.filter(k => typeof node[k] === "string").sort();
    const all     = [...folders, ...files];

    let output = "";

    all.forEach((name, index) => {
        const value = node[name];
        const isLast = index === all.length - 1;

        const branch = isLast ? "└── " : "├── ";
        const nextPrefix = prefix + (isLast ? "    " : "│   ");

        // FOLDER
        if (typeof value === "object") {
            output += `${prefix}${branch}${name}/\n`;
            output += buildAsciiTree(value, nextPrefix);
        }

        // FILE (PATCHED)
        else {
            const ext = path.extname(name);
            let note = "";

            if ((ext === ".jsx" || ext === ".tsx") && isReactSnippetKeyword(value)) {
                note = `  [expands: ${value}]`;
            } else if (isReactSnippetKeyword(value)) {
                note = `  [warning: ${value} ignored]`;
            }

            output += `${prefix}${branch}${name}${note}\n`;
        }
    });

    return output;
}


export {
    buildAsciiTree
};
