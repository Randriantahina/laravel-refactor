import fs from 'fs';

export class FileUpdater {
  updateClassAndNamespace(
    filePath: string,
    oldNamespace: string,
    newNamespace: string,
    oldClass: string,
    newClass: string,
  ) {
    let content = fs.readFileSync(filePath, 'utf-8');

    if (oldNamespace && newNamespace) {
      content = content.replace(
        `namespace ${oldNamespace}`,
        `namespace ${newNamespace}`,
      );
    }

    if (oldClass && newClass) {
      content = content.replace(`class ${oldClass}`, `class ${newClass}`);
    }

    fs.writeFileSync(filePath, content);
  }

  updateReferences(filePath: string, oldFull: string, newFull: string) {
    let content = fs.readFileSync(filePath, 'utf-8');

    if (content.includes(oldFull)) {
      content = content.replaceAll(oldFull, newFull);
      fs.writeFileSync(filePath, content);
    }
  }
}
