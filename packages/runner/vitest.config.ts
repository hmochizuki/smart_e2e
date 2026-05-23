import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'runner',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
