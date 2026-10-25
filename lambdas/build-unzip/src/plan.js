export const LIMITS = { files: 5000, totalBytes: 2 * 1024 ** 3 };

const CONTENT_TYPES = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  js: 'text/javascript',
  mjs: 'text/javascript',
  css: 'text/css',
  json: 'application/json',
  wasm: 'application/wasm',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  webm: 'video/webm',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  txt: 'text/plain; charset=utf-8',
  xml: 'application/xml',
};

const ENCODINGS = { br: 'br', gz: 'gzip' };

export class BuildError extends Error {}

export function safePath(name) {
  const path = name.replace(/\\/g, '/');
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) return null;
  const parts = path.split('/').filter((part) => part && part !== '.');
  if (!parts.length || parts.includes('..')) return null;
  return parts.join('/');
}

export function headersFor(path) {
  const parts = path.toLowerCase().split('/').pop().split('.');
  let ext = parts.pop();
  const encoding = parts.length > 1 ? ENCODINGS[ext] : undefined;
  if (encoding) ext = parts.pop();
  return {
    ContentType: CONTENT_TYPES[ext] ?? 'application/octet-stream',
    ...(encoding && { ContentEncoding: encoding }),
  };
}

export function findEntry(paths) {
  const depth = (path) => path.split('/').length;
  const [entry] = paths
    .filter((path) => path.split('/').pop().toLowerCase() === 'index.html')
    .sort((a, b) => depth(a) - depth(b) || a.localeCompare(b));
  return entry ?? null;
}

export function planFiles(entries) {
  const files = entries.filter((entry) => !entry.fileName.endsWith('/'));
  if (files.length > LIMITS.files) {
    throw new BuildError(`The zip has more than ${LIMITS.files} files`);
  }
  const total = files.reduce((sum, entry) => sum + entry.uncompressedSize, 0);
  if (total > LIMITS.totalBytes) throw new BuildError('The zip is larger than 2 GB when unpacked');

  const planned = files.map((entry) => ({ entry, path: safePath(entry.fileName) }));
  if (planned.some((file) => !file.path))
    throw new BuildError('The zip contains unsafe file paths');

  const entryPath = findEntry(planned.map((file) => file.path));
  if (!entryPath) throw new BuildError('index.html was not found in the zip');
  return { files: planned, entryPath };
}
