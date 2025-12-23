
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {
      API_KEY: process.env.API_KEY,
      CF_API_TOKEN: process.env.CF_API_TOKEN,
      CF_ZONE_ID: process.env.CF_ZONE_ID,
      CF_DOMAIN: process.env.CF_DOMAIN,
    }
  }
});
