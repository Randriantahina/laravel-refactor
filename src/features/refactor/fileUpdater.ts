import * as vscode from 'vscode';

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
      content = content.replace(
        `namespace ${oldNamespace}`,
        `namespace ${newNamespace}`,
      );
    }

    if (oldClass && newClass) {
      content = content.replace(`class ${oldClass}`, `class ${newClass}`);
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

    if (content.includes(oldFull)) {
      content = content.replaceAll(oldFull, newFull);

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
