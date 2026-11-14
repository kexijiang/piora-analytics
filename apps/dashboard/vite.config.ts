import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const apiOrigin = process.env.ANALYTICS_DEV_API_ORIGIN || 'http://127.0.0.1:4319';
export default defineConfig({ plugins: [react()], server:{proxy:{'/v1':apiOrigin,'/health':apiOrigin}}, build: { chunkSizeWarningLimit: 1500 } });
