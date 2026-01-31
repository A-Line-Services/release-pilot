import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/index.js',
  format: 'cjs',
  sourcemap: true,
  // Minify for smaller action size
  minify: true,
  // Keep names for better error messages
  keepNames: true,
});

console.log('Build complete: dist/index.js');
