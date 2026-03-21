import * as assert from 'assert';
import { RefactorService } from '../features/refactor/refactorService';
import path from 'path';

suite('RefactorService', () => {
  const service = new RefactorService();

  test('resolves namespace from PSR-4 mapping in composer.json', () => {
    const file = path.resolve(
      __dirname,
      '../../src/test/fixtures/project/src/Foo/Bar/Baz.php',
    );
    const ns = service.getNamespaceFromPath(file);

    // composer.json maps App\ -> src/, and Baz.php is in src/Foo/Bar/Baz.php
    assert.strictEqual(ns, 'App\\Foo\\Bar');
  });
});
