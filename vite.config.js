import { defineConfig } from 'vite';

export default defineConfig({
  // Use relative paths so it can be deployed to any subpath (GitHub Pages, itch.io, Netlify, Vercel)
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});
