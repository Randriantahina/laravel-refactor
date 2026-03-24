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
  /** Paths being renamed programmatically — onDidRenameFiles must skip these */
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

    // Old class name = current class name in file (may differ from filename)
    const line = document.getText().match(/\bclass\s+(\w+)/);
    const oldClassName = line ? line[1] : path.basename(filePath, '.php');
    const newClassName = newName;

    if (oldClassName === newClassName) {
      return edit;
    }

    const oldNamespace = this.refactor.getNamespaceFromPath(filePath);
    const oldFqcn = this.refactor.buildFullClass(oldNamespace, oldClassName);
    const newFqcn = this.refactor.buildFullClass(oldNamespace, newClassName);

    this.output.appendLine(
      `CLASS RENAME 🔥: ${oldClassName} -> ${newClassName}`,
    );
    this.output.appendLine(`FQCN: ${oldFqcn} -> ${newFqcn}`);

    // 1. Rename the file to match the new class name
    const dir = path.dirname(filePath);
    const newUri = vscode.Uri.file(path.join(dir, `${newClassName}.php`));
    // Mark this rename so onDidRenameFiles can ignore it (avoids double-processing)
    this.pendingRenames.add(filePath);
    setTimeout(() => this.pendingRenames.delete(filePath), 5000);
    edit.renameFile(document.uri, newUri, { overwrite: false });
    this.output.appendLine(`Renaming file: ${filePath} -> ${newUri.fsPath}`);

    // 2. Update class declaration inside the file
    // IMPORTANT: use newUri (not document.uri) because VS Code applies renameFile
    // operations BEFORE text edits — document.uri no longer exists at apply time.
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

    // 3. Update all references across the project
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

    for (const f of files) {
      if (f === filePath) {
        continue;
      } // already handled above
      try {
        const fileUri = vscode.Uri.file(f);
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const content = doc.getText();
        let newContent = content;

        // Pass 1: Replace FQCN occurrences (use statements, fully-qualified usages, with or without
        // leading backslash). The negative lookahead prevents matching oldFqcn as a substring
        // of an already-replaced newFqcn (e.g. AccountDto inside AccountDtos → AccountDtoss).
        newContent = newContent.replace(
          new RegExp(`(\\\\?)${escapeRegex(oldFqcn)}(?![A-Za-z0-9_\\\\])`, 'g'),
          (_, leading) => `${leading}${newFqcn}`,
        );

        // Pass 2: Replace short class name usages in code body:
        // new OldClass(, OldClass::class, : OldClass, OldClass $var, etc.
        // Only do this if the class name actually changed.
        if (oldClassName !== newClassName) {
          newContent = newContent.replace(
            new RegExp(
              `(?<![A-Za-z0-9_\\\\])${escapeRegex(oldClassName)}(?![A-Za-z0-9_\\\\])`,
              'g',
            ),
            newClassName,
          );
        }

        if (newContent !== content) {
          this.output.appendLine(`Updating references in ${f}`);
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

    this.output.appendLine('CLASS RENAME: all edits prepared ✅');
    return edit;
  }
}
