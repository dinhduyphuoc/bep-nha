import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'
import { readFileSync } from 'node:fs'
import { driveMiddleware } from './server/drive.mjs'
import { createAppLibrary } from './server/library.mjs'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const recipes = JSON.parse(readFileSync(new URL('./src/data/recipes.json', import.meta.url), 'utf8'))
  const library = createAppLibrary(env, recipes)
  const middleware = driveMiddleware(library)
  function attach(server) { library.start(); server.middlewares.use(middleware); server.httpServer?.once('close', () => library.stop()) }
  return {
  plugins: [
    { name: 'drive-library', configureServer: attach, configurePreviewServer: attach },
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  }
})
