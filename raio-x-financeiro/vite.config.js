import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/CODE1/',
  optimizeDeps: {
    // pdfjs-dist usa importações dinâmicas internas — excluir do pre-bundle evita erros
    exclude: ['pdfjs-dist'],
  },
  build: {
    rollupOptions: {
      output: {
        // Separa pdfjs-dist num chunk próprio para não inflar o bundle principal
        manualChunks: {
          pdfjs: ['pdfjs-dist'],
        },
      },
    },
  },
})
