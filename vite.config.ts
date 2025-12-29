import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        // Proxy API calls to MiMo during local development
        // In production, this is handled by Cloudflare Function
        '/api-mimo': {
          target: 'https://api.xiaomimimo.com/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-mimo/, ''),
          headers: {
            // Use local env var for development
            'Authorization': `Bearer ${env.MIMO_API_KEY || env.VITE_MIMO_API_KEY || ''}`,
            'api-key': env.MIMO_API_KEY || env.VITE_MIMO_API_KEY || '',
          },
        },
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      // Target modern browsers for smaller output
      target: 'es2020',
      // Use esbuild for minification (fast, built-in)
      minify: 'esbuild',
      // Code-splitting for better caching
      rollupOptions: {
        output: {
          manualChunks: {
            // Separate vendor chunks for better caching
            'vendor-react': ['react', 'react-dom'],
            'vendor-motion': ['framer-motion'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
      // Increase chunk size warning limit (icons are large but ok)
      chunkSizeWarningLimit: 600,
    },
    // Optimize deps for faster dev server
    optimizeDeps: {
      include: ['react', 'react-dom', 'framer-motion', 'lucide-react'],
    },
  };
});
