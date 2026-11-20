import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/physical-ai/',
  // MuJoCo ships its own WebAssembly loader; pre-bundling it breaks the .wasm lookup.
  optimizeDeps: { exclude: ['@mujoco/mujoco'] },
});
