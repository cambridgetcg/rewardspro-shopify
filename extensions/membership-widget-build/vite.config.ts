import { defineConfig } from 'vite';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: '../theme-app-extension-rewardspro/assets',
    emptyOutDir: false, // Don't clear assets folder (other files might exist)
    lib: {
      entry: resolve(__dirname, 'src/widget.js'),
      name: 'MembershipWidget',
      formats: ['iife'], // Use IIFE format for browser
      fileName: () => 'membership-widget.js',
    },
    rollupOptions: {
      output: {
        // Don't hash the filename
        entryFileNames: 'membership-widget.js',
        assetFileNames: (assetInfo) => {
          // CSS files should be named membership-widget.css
          if (assetInfo.name === 'style.css' || assetInfo.name?.endsWith('.css')) {
            return 'membership-widget.css';
          }
          return assetInfo.name || 'asset';
        },
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // KEEP console logs for debugging
        drop_debugger: true, // Remove debugger statements
        // pure_funcs: [], // Don't remove any console methods
        passes: 2,
      },
      mangle: {
        toplevel: true,
      },
      format: {
        comments: false,
      },
    },
  },
});
