import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
  bundle: true,
  // Mongoose and native bindings load best from node_modules at runtime
  external: ['mongoose', 'agenda', '@agendajs/mongo-backend', 'pino-pretty'],
});
