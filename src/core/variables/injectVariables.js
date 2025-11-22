
function injectVariables(str, values) {
    return str.replace(/\$\{([^}]+)\}/g, (_, name) => values[name] || "");
}

module.exports = {
  injectVariables
};