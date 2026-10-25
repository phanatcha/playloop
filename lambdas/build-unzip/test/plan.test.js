import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BuildError, findEntry, headersFor, LIMITS, planFiles, safePath } from '../src/plan.js';

const entry = (fileName, uncompressedSize = 10) => ({ fileName, uncompressedSize });

test('safePath keeps normal paths and rejects escapes', () => {
  assert.equal(safePath('Build/game.wasm'), 'Build/game.wasm');
  assert.equal(safePath('./a//b\\c.js'), 'a/b/c.js');
  assert.equal(safePath('../etc/passwd'), null);
  assert.equal(safePath('a/../../b'), null);
  assert.equal(safePath('/abs/path'), null);
  assert.equal(safePath('C:/windows/x'), null);
});

test('headersFor sets type and encoding for compressed Unity files', () => {
  assert.deepEqual(headersFor('index.html'), { ContentType: 'text/html; charset=utf-8' });
  assert.deepEqual(headersFor('Build/game.wasm.br'), {
    ContentType: 'application/wasm',
    ContentEncoding: 'br',
  });
  assert.deepEqual(headersFor('Build/game.framework.js.gz'), {
    ContentType: 'text/javascript',
    ContentEncoding: 'gzip',
  });
  assert.deepEqual(headersFor('Build/game.data'), { ContentType: 'application/octet-stream' });
  assert.deepEqual(headersFor('archive.gz'), { ContentType: 'application/octet-stream' });
});

test('findEntry picks the shallowest index.html', () => {
  assert.equal(findEntry(['MyGame/index.html', 'MyGame/docs/index.html']), 'MyGame/index.html');
  assert.equal(findEntry(['index.html', 'a/index.html']), 'index.html');
  assert.equal(findEntry(['game.js']), null);
});

test('planFiles skips folders and returns the entry path', () => {
  const plan = planFiles([entry('MyGame/'), entry('MyGame/index.html'), entry('MyGame/a.js')]);
  assert.equal(plan.entryPath, 'MyGame/index.html');
  assert.deepEqual(
    plan.files.map((file) => file.path),
    ['MyGame/index.html', 'MyGame/a.js'],
  );
});

test('planFiles rejects zip bombs, too many files, unsafe paths and missing index.html', () => {
  assert.throws(() => planFiles([entry('index.html', LIMITS.totalBytes + 1)]), BuildError);
  const many = Array.from({ length: LIMITS.files + 1 }, (_, i) => entry(`f${i}.js`));
  assert.throws(() => planFiles(many), BuildError);
  assert.throws(() => planFiles([entry('index.html'), entry('../x.js')]), /unsafe/);
  assert.throws(() => planFiles([entry('game.js')]), /index.html/);
});
