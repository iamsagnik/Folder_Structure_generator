// reactSnippets.js

/* --------------------------------------------
   React Shorthand Snippet Expansions
   Supported keywords:
   rafce, rfc, rafc, rsc, rcc
--------------------------------------------- */

function inferComponentName(filename) {
    const noExt = filename.replace(/\.[^.]+$/, ""); // remove extension
    return noExt
        .split(/[\.\-_ ]+/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
}

function expandReactSnippet(keyword, filename) {
    // Check override format: rafce:CustomName
    let [key, override] = keyword.split(":");
    const componentName = override || inferComponentName(filename);

    switch (key) {
        case "rafce":
            return (
`import React from 'react';

const ${componentName} = () => {
  return (
    <div>${componentName}</div>
  );
};

export default ${componentName};
`
            );

        case "rfc":
            return (
`import React from 'react';

function ${componentName}() {
  return (
    <div>${componentName}</div>
  );
}

export default ${componentName};
`
            );

        case "rafc":
            return (
`import React from 'react';

const ${componentName} = () => {
  return (
    <div>${componentName}</div>
  );
};
`
            );

        case "rsc":
            return (
`export default function ${componentName}() {
  return (
    <div>${componentName}</div>
  );
}
`
            );

        case "rcc":
            return (
`import React, { Component } from 'react';

class ${componentName} extends Component {
  render() {
    return (
      <div>${componentName}</div>
    );
  }
}

export default ${componentName};
`
            );

        default:
            return null; // not a snippet keyword
    }
}

function isReactSnippetKeyword(value) {
    return /^(rafce|rfc|rafc|rsc|rcc)(:[A-Za-z0-9_]+)?$/.test(value);
}

export {
    expandReactSnippet,
    isReactSnippetKeyword
};
