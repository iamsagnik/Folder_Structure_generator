// Extract all ${variables}
function extractVariables(str) {
    if (typeof str !== "string") return [];
    return [...str.matchAll(/\$\{([^}]+)\}/g)].map(m => m[1]);
}

// Identify ask variables: ${ask:Question}
function isAskVariable(name) {
    return name.startsWith("ask:");
}

// Inject values into file/folder names and file contents
function injectVariables(str, values) {
    if (typeof str !== "string") return str;
    return str.replace(/\$\{([^}]+)\}/g, (_, key) => {
        return values[key] ?? "";
    });
}

// Collect variables across full JSON tree
function collectVariablesFromTree(node, set = new Set()) {
    if (typeof node === "string") {
        extractVariables(node).forEach(v => set.add(v));
        return set;
    }

    if (typeof node === "object" && node !== null) {
        for (const key of Object.keys(node)) {
            extractVariables(key).forEach(v => set.add(v));
            collectVariablesFromTree(node[key], set);
        }
    }

    return set;
}


module.exports = {
    extractVariables,
    isAskVariable,
    injectVariables,
    collectVariablesFromTree
}