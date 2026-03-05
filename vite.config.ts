import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  css: {
    devSourcemap: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@convex": path.resolve(__dirname, "./convex/_generated"),
    },
  },
  build: {
    // Generate unique hashes for cache busting
    rollupOptions: {
      output: {
        // Use content hash in filenames for cache busting
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Generate source maps for debugging
    sourcemap: true,
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  },
});
