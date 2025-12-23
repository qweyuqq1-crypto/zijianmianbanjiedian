
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {
      API_KEY: JSON.stringify(process.env.API_KEY),
      CF_API_TOKEN: JSON.stringify(process.env.CF_API_TOKEN),
      CF_ZONE_ID: JSON.stringify(process.env.CF_ZONE_ID),
      CF_DOMAIN: JSON.stringify(process.env.CF_DOMAIN),
      CF_PROXY_URL: JSON.stringify(process.env.CF_PROXY_URL),
    }
  }
});
