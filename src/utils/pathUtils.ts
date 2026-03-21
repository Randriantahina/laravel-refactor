import path from 'path';

export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function getFileName(filePath: string): string {
  return path.basename(filePath, '.php');
}

export function isPHPFile(filePath: string): boolean {
  return filePath.endsWith('.php');
}

export function isLaravelFile(filePath: string): boolean {
  return normalizePath(filePath).includes('/app/');
}
