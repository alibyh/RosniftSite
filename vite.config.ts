import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// For GitHub Pages, set base to your repository name
// Example: if repo is "alibyh/RosniftSite", use '/RosniftSite/'
// If it's a user site (alibyh.github.io), use '/'
export default defineConfig({
  base: '/RosniftSite/', // GitHub Pages base path
  plugins: [react()],
  server: {
    port: 3000,
    ...(fs.existsSync(path.resolve(process.cwd(), 'localhost+2-key.pem')) && 
        fs.existsSync(path.resolve(process.cwd(), 'localhost+2.pem')) ? {
      https: {
        key: fs.readFileSync(path.resolve(process.cwd(), 'localhost+2-key.pem')),
        cert: fs.readFileSync(path.resolve(process.cwd(), 'localhost+2.pem')),
      }
    } : {}),
    open: true,
  }
})

