import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    server: {
      port: 4000,
      host: '0.0.0.0',
    },
    plugins: [react()],
     preview: {
        host: true,          // listen on 0.0.0.0 (needed on Render)
        port: 4000,          // match your start script if using 4000
        allowedHosts: [
          "myresume-5pjy.onrender.com",
          "localhost",
          "127.0.0.1",
        ],
    },
    // DO NOT expose secret API keys to the browser bundle.
    // Use the backend (/agent/generate-resume) as a proxy for Gemini requests.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
