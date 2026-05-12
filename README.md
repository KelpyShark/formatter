# KelpyShark Formatter

A VS Code extension that provides formatting and syntax highlighting for **KelpyShark** (`.ks`) files.

## Features

- **Document formatting** — auto-formats the entire file on save or via command
- **Syntax highlighting** — keywords, strings, numbers, operators, comments, string interpolation
- **Language configuration** — auto-close brackets/quotes, block comment support, correct indentation rules

## Formatting Rules

| Rule | Behaviour |
| ------ | ----------- |
| Indentation | 4 spaces per level, tabs converted to spaces |
| Brace style | K&R — opening `{` on same line with a space before it |
| Operators | Spaces around `=`, `==`, `!=`, `<`, `>`, `<=`, `>=`, `+`, `-`, `*`, `/`, `%` |
| Compound ops | Spaces around `+=`, `-=`, `*=`, `/=` |
| Commas | Single space after each `,` |
| Blank lines | Multiple blank lines collapsed to one |
| Trailing whitespace | Removed |
| Final newline | Always inserted |

## Usage

### Format on save

Add to your VS Code `settings.json`:

```json
"[kelpyshark]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "kelpyshark.ks-formatter"
}
```

### Format manually

- **Keyboard:** `Shift+Alt+F` (when a `.ks` file is active)
- **Command palette:** `KelpyShark: Format KelpyShark File`

## Development

```bash
npm install
npm run compile
# Press F5 in VS Code to open the Extension Development Host
```

Run the formatter tests (no VS Code needed):

```bash
npm run compile
node out/src/test/formatter.test.js
```

## File Structure

```txt
formatter/
├── src/
│   ├── extension.ts          # Main extension + formatter logic
│   └── test/
│       └── formatter.test.ts # Unit tests (no VS Code API)
├── syntaxes/
│   └── kelpyshark.tmLanguage.json  # TextMate grammar for highlighting
├── language-configuration.json     # Bracket matching, comments, indent rules
├── package.json
└── tsconfig.json
```
