
function extractVariablesFromString(str, set) {
    const regex = /\$\{([^}]+)\}/g;
    let match;
    while ((match = regex.exec(str))) set.add(match[1]);
}

module.exports = {
  extractVariablesFromString
};