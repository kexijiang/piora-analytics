import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], server:{proxy:{'/v1':'http://127.0.0.1:4319','/health':'http://127.0.0.1:4319'}}, build: { chunkSizeWarningLimit: 1500 } });
