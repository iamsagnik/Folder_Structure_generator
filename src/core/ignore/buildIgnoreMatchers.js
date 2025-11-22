const vscode = require("vscode");

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

module.exports = {
  buildIgnoreMatchers 
};