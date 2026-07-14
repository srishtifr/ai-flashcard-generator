import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Reset back to standard single-page application setup
export default defineConfig({
  plugins: [react()],
});