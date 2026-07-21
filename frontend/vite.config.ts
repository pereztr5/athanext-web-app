import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDevelopment = mode === 'development' || mode === 'dev';
  const isQA = mode === 'qa';
  const isProduction = mode === 'production' || mode === 'prod';

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      isDevelopment && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      include: ["src/**/__tests__/**/*.test.ts"],
      environment: "node",
    },
    define: {
      // Make environment mode available at runtime
      '__VITE_MODE__': JSON.stringify(mode),
      '__IS_DEVELOPMENT__': isDevelopment,
      '__IS_QA__': isQA,
      '__IS_PRODUCTION__': isProduction,
    },
    build: {
      // Environment-specific build settings
      sourcemap: isDevelopment || isQA, // Enable source maps for dev/qa
      minify: 'terser', // Always minify to remove consoles
      outDir: 'dist',
      terserOptions: {
        compress: {
          // Remove console.* statements in ALL environments
          drop_console: true,
          drop_debugger: true,
        },
      },
    },
  };
});
