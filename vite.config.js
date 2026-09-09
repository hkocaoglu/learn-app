import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { rmSync } from 'node:fs'

// --mode single: Blogger vb. tek HTML dosyası çıktısı (dist-single/ klasörüne yazar)
export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  if (single) rmSync('dist-single', { recursive: true, force: true })
  return {
    plugins: [react(), ...(single ? [viteSingleFile()] : [])],
    base: './',
    build: {
      target: 'es2019',
      outDir: single ? 'dist-single' : 'dist',
      emptyOutDir: true
    }
  }
})
