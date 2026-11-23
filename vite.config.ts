import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
// Local development runs through `npm run dev:full` (vercel dev), which serves
// the app and the /api functions together on http://127.0.0.1:3000. Spotify
// accepts plain http for loopback addresses, and browsers treat 127.0.0.1 as
// a secure context (needed for crypto.subtle in the PKCE flow), so the local
// HTTPS certificates are no longer needed.
export default defineConfig({
  plugins: [react()],
})
