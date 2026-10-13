import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiTarget = process.env.VITE_API_URL || 'http://localhost:8004'
const port = Number(process.env.PORT) || 5176

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port,
    host: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/health': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/suppliers': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/network': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/risk-events': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/dashboard': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/prioritize': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 2500,
  },
})
