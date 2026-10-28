import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Company Directory feature (TypeScript). The rest of the app uses relative imports.
      '@cd': fileURLToPath(new URL('./src/features/company-directory', import.meta.url)),
    },
  },
  css: {
    // Tailwind only acts on files with @tailwind directives (the directory's directory.css);
    // the host stylesheets pass through unchanged. See tailwind.config.js for the scoping.
    postcss: { plugins: [tailwindcss()] },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    css: false,
  },
});
