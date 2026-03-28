import * as vscode from 'vscode';
import { RefactorService } from './refactorService';
import { ProjectScanner } from './projectScanner';
import { isPHPFile } from '../../utils/pathUtils';
import path from 'path';

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class PhpRenameProvider implements vscode.RenameProvider {
  private refactor = new RefactorService();
  private scanner = new ProjectScanner();
  private pendingRenames = new Set<string>();

  constructor(private output: vscode.OutputChannel) {}

  isPendingRename(oldUri: vscode.Uri): boolean {
    return this.pendingRenames.has(oldUri.fsPath);
  }

  prepareRename(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Range | undefined {
    if (!isPHPFile(document.uri.fsPath)) {
      return undefined;
    }

    const line = document.lineAt(position.line).text;
    const match = line.match(/\bclass\s+(\w+)/);
    if (!match) {
      return undefined;
    }

    const nameStart = line.indexOf(match[1], line.indexOf('class'));
    const nameEnd = nameStart + match[1].length;

    if (position.character < nameStart || position.character > nameEnd) {
      return undefined;
    }

    return new vscode.Range(position.line, nameStart, position.line, nameEnd);
  }

  async provideRenameEdits(
    document: vscode.TextDocument,
    _position: vscode.Position,
    newName: string,
  ): Promise<vscode.WorkspaceEdit> {
    const edit = new vscode.WorkspaceEdit();
    const filePath = document.uri.fsPath;

    const line = document.getText().match(/\bclass\s+(\w+)/);
    const oldClassName = line ? line[1] : path.basename(filePath, '.php');
    const newClassName = newName;

    if (oldClassName === newClassName) {
      return edit;
    }

    const oldNamespace = this.refactor.getNamespaceFromPath(filePath);
    const oldFqcn = this.refactor.buildFullClass(oldNamespace, oldClassName);
    const newFqcn = this.refactor.buildFullClass(oldNamespace, newClassName);

    this.output.show(true);
    this.output.appendLine(
      `CLASS RENAME: ${oldClassName} -> ${newClassName}`,
    );
    this.output.appendLine(`FQCN: ${oldFqcn} -> ${newFqcn}`);
    this.output.appendLine('Fichiers modifiés :');

    const dir = path.dirname(filePath);
    const newUri = vscode.Uri.file(path.join(dir, `${newClassName}.php`));
    this.pendingRenames.add(filePath);
    setTimeout(() => this.pendingRenames.delete(filePath), 5000);
    edit.renameFile(document.uri, newUri, { overwrite: false });
    this.output.appendLine(`Renaming file: ${filePath} -> ${newUri.fsPath}`);

    const text = document.getText();
    const classRegex = new RegExp(
      `((?:readonly\\s+)?(?:abstract\\s+)?class\\s+)${escapeRegex(oldClassName)}\\b`,
    );
    const classMatch = classRegex.exec(text);
    if (classMatch) {
      const start = document.positionAt(
        classMatch.index + classMatch[1].length,
      );
      const end = document.positionAt(
        classMatch.index + classMatch[1].length + oldClassName.length,
      );
      edit.replace(newUri, new vscode.Range(start, end), newClassName);
    }

    const wsFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    const root = wsFolder
      ? wsFolder.uri.fsPath
      : filePath.includes('/app/')
        ? filePath.split('/app/')[0]
        : path.dirname(filePath);
    const files = this.scanner.getAllPHPFiles(root);
    this.output.appendLine(
      `Scanning ${files.length} PHP files for references...`,
    );

    const modifiedFiles: string[] = [];
    const conflictingFiles: string[] = [];
    for (const f of files) {
      if (f === filePath) {
        continue;
      }
      try {
        const fileUri = vscode.Uri.file(f);
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const content = doc.getText();
        let newContent = content;

        newContent = newContent.replace(
          new RegExp(`(\\\\?)${escapeRegex(oldFqcn)}(?![A-Za-z0-9_\\\\])`, 'g'),
          (_, leading) => `${leading}${newFqcn}`,
        );

        if (oldClassName !== newClassName) {
          const conflictingImport = new RegExp(
            `use\\s+(?!${escapeRegex(newFqcn)})[^;]*\\\\${escapeRegex(newClassName)};`,
          ).test(newContent);
          if (!conflictingImport) {
            newContent = newContent.replace(
              new RegExp(
                `(?<![A-Za-z0-9_\\\\])${escapeRegex(oldClassName)}(?![A-Za-z0-9_\\\\])`,
                'g',
              ),
              newClassName,
            );
          } else {
            conflictingFiles.push(path.basename(f));
            this.output.appendLine(
              `  [CONFLICT] ${path.basename(f)}: '${newClassName}' déjà importé d'un autre namespace.`,
            );
          }
        }

        if (newContent !== content) {
          modifiedFiles.push(f);
          this.output.appendLine(`  - ${f}`);
          const fullRange = new vscode.Range(
            doc.positionAt(0),
            doc.positionAt(content.length),
          );
          edit.replace(fileUri, fullRange, newContent);
        }
      } catch (err) {
        this.output.appendLine(`Error updating ${f}: ${String(err)}`);
      }
    }

    const total = modifiedFiles.length + 1;
    this.output.show(true);
    this.output.appendLine(`\nTotal: ${total} fichier(s) à modifier.`);

    if (conflictingFiles.length > 0) {
      await vscode.window.showWarningMessage(
        `Conflit de nommage dans ${conflictingFiles.length} fichier(s) : '${newClassName}' est déjà importé d'un autre namespace. Ces fichiers ne seront pas entièrement mis à jour. Voir 'Laravel Refactor' output.`,
      );
      return new vscode.WorkspaceEdit();
    }

    const choice = await vscode.window.showInformationMessage(
      `Modifications détectées: ${total} fichier(s). Voir 'Laravel Refactor' output pour détails. Appliquer les changements ?`,
      'Apply changes',
      'Cancel',
    );

    if (choice !== 'Apply changes') {
      this.output.appendLine('Rename cancelled by user.');
      return new vscode.WorkspaceEdit();
    }

    this.output.appendLine('CLASS RENAME: all edits applied');
    return edit;
  }
}
