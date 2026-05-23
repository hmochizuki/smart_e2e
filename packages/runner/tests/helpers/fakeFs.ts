import type { FileSystem } from '../../src/playwright/runStep.js';

// インメモリ FS。テストで spec.ts の書き出しを観測するための簡易ダブル。
export const createFakeFileSystem = (): {
  fs: FileSystem;
  files: Map<string, string>;
  dirs: Set<string>;
  readFile: (path: string) => string | undefined;
} => {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const fs: FileSystem = {
    mkdir: (path) => {
      dirs.add(path);
      return Promise.resolve();
    },
    writeFile: (path, contents) => {
      files.set(path, contents);
      return Promise.resolve();
    },
    readFileMaybe: (path) => Promise.resolve(files.get(path) ?? null),
  };
  return { fs, files, dirs, readFile: (p) => files.get(p) };
};
