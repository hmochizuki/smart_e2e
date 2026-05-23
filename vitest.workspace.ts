import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  './packages/shared/vitest.config.ts',
  './packages/runner/vitest.config.ts',
  './packages/persistence/vitest.config.ts',
  './packages/app/vitest.config.ts',
]);
