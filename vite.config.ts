import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@prvse': path.resolve(__dirname, '../prvse_world_workspace/src'),
      '@excalidraw/excalidraw': path.resolve(__dirname, '../excalidraw/packages/excalidraw/dist/dev'),
    },
  },
  server: {
    port: 3000,
    host: true,
    open: true,
    proxy: {
      '/seai': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/seai/, ''),
      },
      '/ws': {
        target: 'ws://localhost:3002',
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
        timeout: 90000,
        proxyTimeout: 90000,
        configure: (proxy, _) => {
          proxy.on('error', (err, _) => {
            console.log('proxy error', err)
          })
          proxy.on('proxyReq', (proxyReq, req, _) => {
            console.log('Sending Request to the Target:', req.method, req.url)
          })
          proxy.on('proxyRes', (proxyRes, req, _) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url)
          })
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})