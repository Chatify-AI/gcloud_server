import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Listen on all interfaces
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true
      },
      '/socket.io': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        ws: true,
        changeOrigin: true
      }
    }
  }
})