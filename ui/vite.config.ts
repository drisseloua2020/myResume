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
          "www.myresumes.net",
          "myresumes.net",
          "localhost",
          "127.0.0.1",
        ],
    },
    // Resume imports use the backend deterministic parser at /resumes/parse-upload.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
