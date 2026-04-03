import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Activated formatter');
    const disposable = vscode.commands.registerCommand('extension.formatDocument', () => {
        vscode.window.showInformationMessage('Document formatted!');
    });
    context.subscriptions.push(disposable);
    vscode.languages.registerDocumentFormattingEditProvider('kelpyshark', {
        provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
            const firstLine = document.lineAt(0);
            const lastLine = document.lineAt(document.lineCount - 1);
            const fullRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
            console.log('Formatting document...');
            return [vscode.TextEdit.replace(fullRange, formattedText)];
        }
    });
}

export function deactivate() {
    console.log('Deactivated formatter');
}

export function formatDocument(document: vscode.TextDocument): string {
    const text = document.getText(); // grab text
    
}