import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Tauri expects 1420; PORT lets an external preview tool pick another port.
    port: Number(process.env.PORT) || 1420,
    strictPort: true,
  },
})
