import * as vscode from 'vscode';

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function hasUseConflict(
  content: string,
  oldFull: string,
  newFull: string,
  newShortName: string,
): boolean {
  // A real conflict is a `use` statement that imports the same short name
  // from a *different* namespace — but NOT the old import we're about to update.
  return new RegExp(
    `use\\s+(?!${escapeRegex(newFull)})(?!${escapeRegex(oldFull)})[^;]*\\\\${escapeRegex(newShortName)};`,
  ).test(content);
}

export type DryRunResult = {
  file: string;
  oldContent: string;
  newContent: string;
}[];

export class FileUpdater {
  async updateClassAndNamespace(
    filePath: string,
    oldNamespace: string,
    newNamespace: string,
    oldClass: string,
    newClass: string,
    dryRun = false,
  ): Promise<DryRunResult | void> {
    const uri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    const original = doc.getText();
    let content = original;

    if (oldNamespace && newNamespace) {
      const escOldNs = escapeRegex(oldNamespace);
      const nsRegex = new RegExp(`(^\\s*namespace\\s+)${escOldNs}(\\s*;)`, 'm');
      if (nsRegex.test(content)) {
        content = content.replace(nsRegex, `$1${newNamespace}$2`);
      }
    }

    if (oldClass && newClass) {
      const escOldClass = escapeRegex(oldClass);
      const classRegex = new RegExp(`(class\\s+)${escOldClass}\\b`);
      if (classRegex.test(content)) {
        content = content.replace(classRegex, `$1${newClass}`);
      }
    }

    if (dryRun) {
      if (content !== original) {
        return [{ file: filePath, oldContent: original, newContent: content }];
      }
      return [];
    }

    if (content !== original) {
      const fullRange = new vscode.Range(
        doc.positionAt(0),
        doc.positionAt(original.length),
      );
      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, fullRange, content);
      await vscode.workspace.applyEdit(edit);
      await doc.save();
    }
    return;
  }

  async updateReferences(
    filePath: string,
    oldFull: string,
    newFull: string,
    dryRun = false,
  ): Promise<DryRunResult | void> {
    const uri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    const original = doc.getText();
    let content = original;

    const oldClassName = oldFull.includes('\\')
      ? oldFull.split('\\').pop()!
      : oldFull;
    const newClassName = newFull.includes('\\')
      ? newFull.split('\\').pop()!
      : newFull;

    const fqcnRegex = new RegExp(
      `(\\\\?)${escapeRegex(oldFull)}(?![A-Za-z0-9_\\\\])`,
      'g',
    );
    content = content.replace(
      fqcnRegex,
      (_, leading) => `${leading}${newFull}`,
    );

    if (oldClassName !== newClassName) {
      const conflictingImport = new RegExp(
        `use\\s+(?!${escapeRegex(newFull)})[^;]*\\\\${escapeRegex(newClassName)};`,
      ).test(content);
      if (!conflictingImport) {
        const shortRegex = new RegExp(
          `(?<![A-Za-z0-9_\\\\])${escapeRegex(oldClassName)}(?![A-Za-z0-9_\\\\])`,
          'g',
        );
        content = content.replace(shortRegex, newClassName);
      }
    }

    if (dryRun) {
      if (content !== original) {
        return [{ file: filePath, oldContent: original, newContent: content }];
      }
      return [];
    }

    if (content !== original) {
      const fullRange = new vscode.Range(
        doc.positionAt(0),
        doc.positionAt(original.length),
      );
      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, fullRange, content);
      await vscode.workspace.applyEdit(edit);
      await doc.save();
    }
    return;
  }
}
