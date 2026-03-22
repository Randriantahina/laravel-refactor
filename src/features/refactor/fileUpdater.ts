import * as vscode from 'vscode';

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type DryRunResult = {
  file: string;
  oldContent: string;
  newContent: string;
}[];

export class FileUpdater {
  /**
   * Update namespace and class in a file. If dryRun is true, returns the predicted changes without applying.
   */
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

    console.log('UPDATER.updateClassAndNamespace', {
      filePath,
      oldNamespace,
      newNamespace,
      oldClass,
      newClass,
      dryRun,
    });

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
        console.log('UPDATER.dryRun: changes detected for', filePath);
        return [{ file: filePath, oldContent: original, newContent: content }];
      }
      console.log('UPDATER.dryRun: no changes for', filePath);
      return [];
    }

    if (content !== original) {
      console.log('UPDATER: applying edit to', filePath);
      const fullRange = new vscode.Range(
        doc.positionAt(0),
        doc.positionAt(content.length),
      );
      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, fullRange, content);
      await vscode.workspace.applyEdit(edit);
      await doc.save();
      console.log('UPDATER: applied edit to', filePath);
    } else {
      console.log('UPDATER: no changes to apply for', filePath);
    }
    return;
  }

  /**
   * Update references across a file. Handles `use` statements and fully-qualified occurrences.
   * If dryRun is true, returns predicted changes without applying.
   */
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

    console.log('UPDATER.updateReferences', {
      filePath,
      oldFull,
      newFull,
      dryRun,
    });

    // Handle `use` statements (preserve leading backslash if present)
    content = content.replace(
      new RegExp(
        `(^\\s*use\\s+)(\\\\?){0,1}${escapeRegex(oldFull)}(\\s*;)`,
        'm',
      ),
      (match, p1, p2, p3) => {
        const leading = p2 || '';
        return `${p1}${leading}${newFull}${p3}`;
      },
    );

    // Replace fully-qualified occurrences with leading backslash
    const withLeading = `\\${oldFull}`;
    const withLeadingNew = `\\${newFull}`;
    if (content.includes(withLeading)) {
      content = content.split(withLeading).join(withLeadingNew);
    }

    // Replace plain occurrences
    if (content.includes(oldFull)) {
      content = content.split(oldFull).join(newFull);
    }

    if (dryRun) {
      if (content !== original) {
        console.log(
          'UPDATER.updateReferences dryRun: changes detected for',
          filePath,
        );
        return [{ file: filePath, oldContent: original, newContent: content }];
      }
      console.log('UPDATER.updateReferences dryRun: no changes for', filePath);
      return [];
    }

    if (content !== original) {
      console.log('UPDATER.updateReferences: applying edit to', filePath);
      const fullRange = new vscode.Range(
        doc.positionAt(0),
        doc.positionAt(content.length),
      );
      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, fullRange, content);
      await vscode.workspace.applyEdit(edit);
      await doc.save();
      console.log('UPDATER.updateReferences: applied edit to', filePath);
    } else {
      console.log(
        'UPDATER.updateReferences: no changes to apply for',
        filePath,
      );
    }
    return;
  }
}
