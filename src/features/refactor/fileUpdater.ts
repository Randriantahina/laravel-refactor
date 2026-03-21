import * as vscode from 'vscode';

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class FileUpdater {
  async updateClassAndNamespace(
    filePath: string,
    oldNamespace: string,
    newNamespace: string,
    oldClass: string,
    newClass: string,
  ) {
    const uri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    let content = doc.getText();

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

    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(content.length),
    );
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, fullRange, content);
    await vscode.workspace.applyEdit(edit);
    await doc.save();
  }

  async updateReferences(filePath: string, oldFull: string, newFull: string) {
    const uri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    let content = doc.getText();

    // Replace occurrences with and without leading backslash, preserving leading backslash if present
    const withLeading = '\\' + oldFull;
    const withLeadingNew = '\\' + newFull;

    let changed = false;

    if (content.includes(withLeading)) {
      content = content.split(withLeading).join(withLeadingNew);
      changed = true;
    }

    if (content.includes(oldFull)) {
      content = content.split(oldFull).join(newFull);
      changed = true;
    }

    if (changed) {
      const fullRange = new vscode.Range(
        doc.positionAt(0),
        doc.positionAt(content.length),
      );
      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, fullRange, content);
      await vscode.workspace.applyEdit(edit);
      await doc.save();
    }
  }
}
