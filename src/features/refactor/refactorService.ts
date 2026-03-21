import { normalizePath, getFileName } from '../../utils/pathUtils';

export class RefactorService {
  getNamespaceFromPath(filePath: string): string {
    const normalized = normalizePath(filePath);

    const appIndex = normalized.indexOf('/app/');
    if (appIndex === -1) return '';

    const relative = normalized.substring(appIndex + 1);

    return relative
      .replace('app/', 'App/')
      .replace('.php', '')
      .split('/')
      .slice(0, -1)
      .join('\\');
  }

  getClassNameFromPath(filePath: string): string {
    return getFileName(filePath);
  }

  buildFullClass(namespace: string, className: string): string {
    return `${namespace}\\${className}`;
  }
}
