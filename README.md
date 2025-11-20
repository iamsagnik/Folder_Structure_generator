# Folder Structure Generator

Folder Structure Generator is a VS Code extension that generates entire folder and file structures from declarative `.sgmtr` template files. It supports static and dynamic generation, live previews, reusable workspace templates, React snippet expansion, ignore rules, grammar-based validation, and reverse generation.

This extension enables consistent and reusable project scaffolding for individuals and teams.

---

## Features

### 1. Generate From `.sgmtr` Files
A `.sgmtr` file defines a folder structure using nested JSON.  
Keys represent folders or filenames; string values represent file contents.

Example:
```
{
  "src": {
    "index.js": "",
    "components": {
      "${ask:Name}.jsx": "rafc"
    }
  },
  "README.md": "# Project"
}
```
Running "Generate from .sgmtr file" builds the full structure.

### 2. Dynamic Variable Injection

Variables can be used inside filenames and file contents.

Supported variables:
- ${ask:Var} – prompts user during generation
- ${workspaceName} – workspace folder name
- ${date} – ISO date
- ${time} – time in HH:MM:SS
- ${Custom} – resolved if defined in template

Dynamic filenames:
```
"${ask:Page}.jsx"
"Config-${ask:Env}.js"
"README-${date}.md"
```

## 3. Webview-Based Previews

All previews use a VS Code Webview.
Types of previews:
- Static preview (raw structure as ASCII tree)
- Dynamic preview (injects placeholder values)
- Detailed preview (imports/exports for .jsx and .tsx files)
- Snippet keywords and detected components are shown when applicable.

### 4. Workspace-Level Template Library

If a workspace contains:
```
.sgmtr/templates/*.sgmtr
```

The extension will:

- scan all template files  
- list them in a QuickPick menu  
- generate the selected template anywhere in the workspace  

This is useful for team-shared boilerplates and reusable scaffolding patterns.

Example structure:
```
.sgmtr/templates
├── default.sgmtr
├── react.sgmtr
└── vue.sgmtr
```
### 5. Reverse Generation

Select any folder → **Create .sgmtr from Folder**

This converts existing folders back into `.sgmtr` templates, applying:

- snippet detection  
- structure extraction  
- ignore rules  

Useful for documenting or reusing existing component patterns.

### 6. `.sgmtrignore` Support

Patterns similar to `.gitignore`.

Supports:

- wildcard patterns  
- folder rules  
- negations (`!pattern`)  
- auto-expand patterns (`folder/**`)  

Affects both preview and reverse generation.

### 7. Snippet Expansion for React

Expands snippet keywords in `.jsx` and `.tsx` files:

- `rafc`  
- `rafce`  
- `rfc`  
- `rsc`  
- `rcc`  

Each keyword is replaced with its corresponding React component scaffold.

### 8. Syntax Highlighting, Grammar, and Schema Validation

`.sgmtr` files include:

- custom syntax highlighting  
- TextMate grammar rules  
- JSON schema validation  

Validation errors appear directly in the editor.

## Commands

| Command | Description |
|--------|-------------|
| **SGMTR: Preview Structure** | Preview a `.sgmtr` file (static or detailed). |
| **SGMTR: Generate from .sgmtr file** | Create the folder structure defined in the file. |
| **SGMTR: Create .sgmtr from Folder** | Reverse-generate a `.sgmtr` from a folder. |
| **SGMTR: Generate From Workspace Template** | Choose a reusable template from `.sgmtr/templates/`. |

Commands are also available from the Explorer context menu.

## Template Examples

### Basic Template
```
{
  "src": {
    "App.jsx": "rafc",
    "styles": {
      "global.css": ""
    }
  }
}
```
---
### Dynamic Template

```
{
  "feature-${ask:Name}": {
    "${ask:Name}.jsx": "rafc",
    "${ask:Name}.css": ""
  }
}
```
---
### Workspace Template Example

#### Location:
`.sgmtr/templates/react-component.sgmtr`

#### Template:
```
{
  "${ask:Component}.jsx": "rafce",
  "${ask:Component}.css": ""
}
```
---
### Reverse Generation Example

#### Folder:

```
components/
    Button.jsx
    Button.css
```

#### Generated .sgmtr:

```
{
  "Button.jsx": "rafc",
  "Button.css": ""
}
```
---
### Ignore Rules Example

`.sgmtrignore:`
```
dist/
node_modules/
*.log
!src/keep.log
```
---
