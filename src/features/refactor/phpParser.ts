import fs from 'fs';
// @ts-ignore
import parser from 'php-parser';

const engine = new parser.Engine({
  parser: {
    extractDoc: true,
    php7: true,
  },
  ast: {
    withPositions: true,
  },
});

export class PhpParser {
  parse(filePath: string) {
    const code = fs.readFileSync(filePath, 'utf-8');
    const ast = engine.parseCode(code, filePath);
    console.log('PARSE OK:', filePath);
    return ast;
  }

  getClassInfo(ast: any) {
    let namespace = '';
    let className = '';

    const nameFromNode = (n: any) => {
      if (!n) {
        return '';
      }
      if (typeof n === 'string') {
        return n;
      }
      if (typeof n.name === 'string') {
        return n.name;
      }
      if (Array.isArray(n.parts)) {
        return n.parts.join('\\');
      }
      return '';
    };

    (ast.children || []).forEach((node: any) => {
      if (node.kind === 'namespace') {
        namespace = nameFromNode(node.name);

        (node.children || []).forEach((child: any) => {
          if (child.kind === 'class' && child.name) {
            className = child.name.name;
          }
        });
      }

      if (node.kind === 'class' && node.name) {
        className = node.name.name;
      }
    });

    console.log('PARSE INFO:', { namespace, className });
    return { namespace, className };
  }
}
