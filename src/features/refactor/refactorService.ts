import fs from 'fs';
import path from 'path';
import { normalizePath, getFileName } from '../../utils/pathUtils';

type Psr4Map = Array<{ namespace: string; dir: string }>;

export class RefactorService {
  private psr4: Psr4Map | null = null;

  private loadPsr4Mappings(startPath: string): Psr4Map {
    if (this.psr4) {
      return this.psr4;
    }

    let dir = path.dirname(startPath);
    let composerPath = '';

    while (true) {
      const candidate = path.join(dir, 'composer.json');
      if (fs.existsSync(candidate)) {
        composerPath = candidate;
        console.log('PSR-4 composer.json found at', composerPath);
        break;
      }
      const parent = path.dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }

    if (!composerPath) {
      this.psr4 = [];
      return this.psr4;
    }

    try {
      const raw = fs.readFileSync(composerPath, 'utf-8');
      const composer = JSON.parse(raw);
      const mappings = composer.autoload?.['psr-4'] || {};
      const result: Psr4Map = [];

      Object.entries(mappings).forEach(([ns, rel]) => {
        if (Array.isArray(rel)) {
          rel.forEach((r) => {
            result.push({
              namespace: ns.replace(/\\$/, ''),
              dir: path.resolve(path.dirname(composerPath), r),
            });
          });
        } else {
          result.push({
            namespace: ns.replace(/\\$/, ''),
            dir: path.resolve(path.dirname(composerPath), rel as string),
          });
        }
      });

      this.psr4 = result;
      console.log('PSR-4 mappings loaded:', result);
      return this.psr4;
    } catch (e) {
      console.log('Error parsing composer.json for PSR-4 mappings', e);
      this.psr4 = [];
      return this.psr4;
    }
  }

  getNamespaceFromPath(filePath: string): string {
    const normalized = normalizePath(filePath);

    const mappings = this.loadPsr4Mappings(filePath);
    for (const m of mappings) {
      const mapDir = normalizePath(m.dir);
      if (normalized.startsWith(mapDir)) {
        console.log('RefactorService: matched PSR-4 mapping', m);
        const rel = normalized.substring(mapDir.length).replace(/^\//, '');
        const withoutExt = rel.replace(/\.php$/, '');
        const parts = withoutExt.split('/').slice(0, -1).filter(Boolean);
        const nsParts = [m.namespace.replace(/\\$/, '')].concat(
          parts.map((p) => p),
        );
        return nsParts.filter(Boolean).join('\\');
      }
    }

    const appIndex = normalized.indexOf('/app/');
    if (appIndex === -1) {
      console.log(
        'RefactorService: no PSR-4 mapping and not inside /app/ for',
        filePath,
      );
      return '';
    }

    const relative = normalized.substring(appIndex + 1);

    console.log(
      'RefactorService: falling back to /app/ convention for',
      filePath,
    );
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
