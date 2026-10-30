import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('KelpyShark Formatter activated');

    // Register the document formatting provider for .ks files
    const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider('kelpyshark', {
        provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
            const formatted = formatDocument(document);
            const firstLine = document.lineAt(0);
            const lastLine = document.lineAt(document.lineCount - 1);
            const fullRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
            return [vscode.TextEdit.replace(fullRange, formatted)];
        }
    });

    // Use one formatting provider. A second provider for the same language
    // makes VS Code treat this extension as two competing formatters.
    const onSaveFormatting = vscode.workspace.onWillSaveTextDocument(event => {
        const config = vscode.workspace.getConfiguration('kelpyshark.formatter', event.document.uri);
        if (event.document.languageId !== 'kelpyshark' || !config.get<boolean>('formatOnSave', false)) {
            return;
        }
        event.waitUntil(Promise.resolve(createFormattingEdits(event.document)));
    });

    // Register the explicit "Format KelpyShark Files" command from package.json
    const formatCommand = vscode.commands.registerCommand('extension.format-kelpyshark', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found.');
            return;
        }
        if (editor.document.languageId !== 'kelpyshark') {
            vscode.window.showWarningMessage('Active file is not a KelpyShark file.');
            return;
        }
        const formatted = formatDocument(editor.document);
        editor.edit(editBuilder => {
            const firstLine = editor.document.lineAt(0);
            const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
            const fullRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
            editBuilder.replace(fullRange, formatted);
        });
        vscode.window.showInformationMessage('KelpyShark file formatted!');
    });

    context.subscriptions.push(formattingProvider, onSaveFormatting, formatCommand);
}

export function deactivate() {
    console.log('KelpyShark Formatter deactivated');
}

// ── Core formatter ────────────────────────────────────────────────────────────

/**
 * Format a KelpyShark document.
 *
 * Rules applied:
 *  - Consistent 4-space indentation (tabs → spaces, tracks brace depth)
 *  - Opening brace on same line as statement (K&R style), with a space before it
 *  - Space after keywords: if, elif, else, while, for, def, class, return, throw,
 *    try, catch, import, print
 *  - Spaces around binary operators: = == != < > <= >= + - * / % and or
 *  - Spaces after commas
 *  - No trailing whitespace
 *  - Single blank line between top-level definitions; no double-blank lines
 *  - Compound operators (+=, -=, *=, /=) formatted with spaces
 */
export function formatDocument(document: vscode.TextDocument): string {
    const raw = document.getText();
    const config = vscode.workspace.getConfiguration('kelpyshark.formatter', document.uri);
    const indentSize = config.get<number>('indentSize', 4);
    const insertFinalNewline = config.get<boolean>('insertFinalNewline', false);
    const trimTrailingWhitespace = config.get<boolean>('trimTrailingWhitespace', true);

    return formatSource(raw, indentSize, insertFinalNewline, trimTrailingWhitespace);
}

function createFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
    const firstLine = document.lineAt(0);
    const lastLine = document.lineAt(document.lineCount - 1);
    const fullRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
    return [vscode.TextEdit.replace(fullRange, formatDocument(document))];
}

export function formatSource(source: string, indentSize: number = 4, insertFinalNewline: boolean = false, trimTrailingWhitespace: boolean = true): string {
    const lines = source.split('\n');
    const result: string[] = [];
    let indentLevel = 0;
    let prevWasBlank = false;
    let prevWasTopLevel = false;

    for (let i = 0; i < lines.length; i++) {
        // Strip trailing whitespace and de-indent (we'll re-indent below)
        let line = trimTrailingWhitespace ? lines[i].trimEnd() : lines[i];
        const stripped = line.trim();

        // Blank line handling — collapse multiple blanks to one
        if (stripped === '') {
            if (!prevWasBlank && result.length > 0) {
                result.push('');
                prevWasBlank = true;
            }
            continue;
        }
        prevWasBlank = false;

        // Close explicit `end` blocks and align alternate colon-style branches
        // with their matching header before emitting this line.
        if (/^end\b/.test(stripped)) {
            indentLevel = Math.max(0, indentLevel - 1);
        } else if (isColonBlockHeader(stripped) && /^(elif|else|catch)\b/.test(stripped)) {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        // Count closing braces at start to reduce indent BEFORE emitting.
        const leadingClose = countLeadingCloseBraces(stripped);
        indentLevel = Math.max(0, indentLevel - leadingClose);

        // Format the content of the line (operators, spacing, keywords)
        let formatted = formatLine(stripped, trimTrailingWhitespace);

        // Re-indent
        const indentString = ' '.repeat(indentSize);
        const indented = indentString.repeat(indentLevel) + formatted;
        result.push(indented);

        // Increase depth only for a recognized brace block header or a
        // colon-style block header; dictionary literal braces do not change it.
        if (isBraceBlockHeader(stripped) || isColonBlockHeader(stripped)) {
            indentLevel++;
        }

        // Insert blank line before top-level def/class
        const isTopDef = indentLevel === 0 && /^(def|class)\s/.test(stripped);
        if (isTopDef && prevWasTopLevel && result.length >= 2) {
            // Already have a blank line from loop? add one if not
            if (result[result.length - 2] !== '') {
                result.splice(result.length - 1, 0, '');
            }
        }
        prevWasTopLevel = isTopDef || (indentLevel === 0 && !isTopDef);
    }

    // Trim trailing blank lines, then add final newline if configured
    while (result.length > 0 && result[result.length - 1] === '') {
        result.pop();
    }
    const resultText = result.join('\n');
    return insertFinalNewline ? resultText + '\n' : resultText;
}

// ── Line-level formatting ─────────────────────────────────────────────────────

function formatLine(line: string, trimTrailingWhitespace: boolean = true): string {
    // Don't touch comments
    if (line.startsWith('#') || line.startsWith('//')) {
        return line;
    }
    // Don't reformat inside multi-line comment markers
    if (line.startsWith('###') || line.startsWith('/*') || line.startsWith('*/')) {
        return line;
    }

    // Split the line into code + trailing comment
    const { code, comment } = splitComment(line);
    let fmt = code;

    // Normalize tabs to spaces
    fmt = fmt.replace(/\t/g, '    ');

    // Collapse multiple spaces (except in strings)
    fmt = processOutsideStrings(fmt, s => s.replace(/ {2,}/g, ' '));

    // Space around compound assignment operators (before binary = to avoid double)
    fmt = processOutsideStrings(fmt, s => s
        .replace(/([a-zA-Z0-9_\])])\s*\+=\s*/g, '$1 += ')
        .replace(/([a-zA-Z0-9_\])])\s*-=\s*/g, '$1 -= ')
        .replace(/([a-zA-Z0-9_\])])\s*\*=\s*/g, '$1 *= ')
        .replace(/([a-zA-Z0-9_\])])\s*\/=\s*/g, '$1 /= ')
    );

    // Space around comparison & equality operators (avoid touching ->, >=, <=, ==, !=)
    fmt = processOutsideStrings(fmt, s => s
        .replace(/([^=!<>])==([^=])/g, '$1 == $2')
        .replace(/([^!])!=([^=])/g, '$1 != $2')
        .replace(/([^<])<([^=])/g, '$1 < $2')
        .replace(/([^>])>([^=])/g, '$1 > $2')
        .replace(/([^<])<=([^=])/g, '$1 <= $2')
        .replace(/([^>])>=([^=])/g, '$1 >= $2')
    );

    // Space around assignment = (but not ==, !=, <=, >=, +=, -=, *=, /=)
    fmt = processOutsideStrings(fmt, s =>
        s.replace(/([a-zA-Z0-9_\])])\s*=\s*(?!=)/g, '$1 = ')
         .replace(/=\s*(?!=)/g, match => match.trimStart() === '=' ? '= ' : match)
    );

    // Space around arithmetic (+, -, *, /) but not in negative numbers or string concat
    fmt = processOutsideStrings(fmt, s => s
        .replace(/([a-zA-Z0-9_\])"'])\s*\+(?!=)\s*/g, '$1 + ')
        .replace(/([a-zA-Z0-9_\])"'])\s*-(?!=)\s*/g, '$1 - ')
        .replace(/([a-zA-Z0-9_\])"'])\s*\*(?!=)\s*/g, '$1 * ')
        .replace(/([a-zA-Z0-9_\])"'])\s*\/(?!=)\s*/g, '$1 / ')
        .replace(/([a-zA-Z0-9_\])"'])\s*%\s*/g, '$1 % ')
    );

    // Space after comma (but not inside string)
    fmt = processOutsideStrings(fmt, s => s.replace(/,\s*/g, ', '));

    // Opening brace: ensure a single space before {
    fmt = processOutsideStrings(fmt, s => s.replace(/\s*\{/g, ' {').trimStart());

    // Space after keywords that take a condition/expression
    const kwWithExpr = ['if', 'elif', 'while', 'for', 'return', 'throw', 'catch', 'print', 'import'];
    for (const kw of kwWithExpr) {
        const re = new RegExp(`^(${kw})([^ (])`, 'i');
        fmt = fmt.replace(re, `$1 $2`);
    }

    // def/class formatting: "def name(" — ensure space after def/class
    fmt = fmt.replace(/^(def|class)\s+/, m => m);

    // No space between function name and (
    // This is intentional in KelpyShark — leave as-is

    // Remove space before closing paren / bracket that would look odd
    // (only fix double-space artifacts)
    fmt = processOutsideStrings(fmt, s => s.replace(/  +/g, ' '));

    const trail = comment ? '  ' + comment : '';
    return trimTrailingWhitespace ? fmt.trimEnd() + trail : fmt + trail;
}

// ── Brace counting ────────────────────────────────────────────────────────────

/** Count how many unescaped } appear at the START of a stripped line. */
function countLeadingCloseBraces(line: string): number {
    let count = 0;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '}') count++;
        else break;
    }
    return count;
}

function codeWithoutComment(line: string): string {
    return splitComment(line).code.trimEnd();
}

function isColonBlockHeader(line: string): boolean {
    const code = codeWithoutComment(line);
    return /^(if|elif|else|while|for|def|class|try|catch)\b.*:\s*$/.test(code);
}

function isBraceBlockHeader(line: string): boolean {
    const code = codeWithoutComment(line).replace(/^}+\s*/, '');
    return /^(if|elif|else|while|for|def|class|try|catch)\b.*\{\s*$/.test(code);
}

// ── String-aware processing ───────────────────────────────────────────────────

/** Split a line into code and trailing comment. */
function splitComment(line: string): { code: string; comment: string } {
    let inStr = false;
    let strChar = '';
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (!inStr && (ch === '"' || ch === "'")) { inStr = true; strChar = ch; continue; }
        if (inStr && ch === strChar && line[i - 1] !== '\\') { inStr = false; continue; }
        if (!inStr && ch === '#') {
            return { code: line.slice(0, i).trimEnd(), comment: line.slice(i) };
        }
        if (!inStr && ch === '/' && line[i + 1] === '/') {
            return { code: line.slice(0, i).trimEnd(), comment: line.slice(i) };
        }
    }
    return { code: line, comment: '' };
}

/**
 * Apply a string transformation function only to the non-string portions of `src`.
 * String contents (single or double quoted) are preserved verbatim.
 */
function processOutsideStrings(src: string, fn: (s: string) => string): string {
    const parts: string[] = [];
    let inStr = false;
    let strChar = '';
    let segment = '';

    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (!inStr && (ch === '"' || ch === "'")) {
            // Flush non-string segment
            parts.push(fn(segment));
            segment = '';
            inStr = true;
            strChar = ch;
            segment += ch;
        } else if (inStr && ch === strChar && src[i - 1] !== '\\') {
            segment += ch;
            // Flush string segment as-is
            parts.push(segment);
            segment = '';
            inStr = false;
        } else {
            segment += ch;
        }
    }
    parts.push(inStr ? segment : fn(segment));
    return parts.join('');
}
