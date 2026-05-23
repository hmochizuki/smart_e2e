import react from '@vitejs/plugin-react';
import { defineProject } from 'vitest/config';

export default defineProject({
  plugins: [react()],
  test: {
    name: 'app',
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
  },
});
