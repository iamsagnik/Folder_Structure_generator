
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

module.exports = { 
  collectVariablesFromTree 
};