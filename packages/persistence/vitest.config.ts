import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'persistence',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
