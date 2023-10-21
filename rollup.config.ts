import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import obfuscator from 'rollup-plugin-obfuscator';
import json from '@rollup/plugin-json'; // This plugin allows you to import JSON files in your TypeScript code
import terser from '@rollup/plugin-terser';
import { RollupOptions } from 'rollup';

const isProduction = process.env.NODE_ENV === 'production';
export default {
  input: 'src/index.ts', // Replace with your entry TypeScript file
  output: [
    {
      file: 'dist/esm/index.js',
      format: 'esm',
      sourcemap: !isProduction
    },
    {
      file: 'dist/cjs/index.js',
      format: 'cjs',
      sourcemap: !isProduction
    }
  ],
  plugins: [
    typescript({
      tsconfig: isProduction ? './tsconfig.prod.json' : './tsconfig.dev.json'
    }),
    {
      name: 'add-environment-variables',
      renderChunk(code, chunk, options) {
        if (chunk.fileName === 'index.js') {
          return `process.env.IS_BUNDLED='true';\n` + code;
        }
        return code;
      }
    },
    commonjs({
      sourceMap: !isProduction
    }),
    resolve(),
    json(),
    obfuscator({
      options: {
        // Your javascript-obfuscator options here
        // See what's allowed: https://github.com/javascript-obfuscator/javascript-obfuscator
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 1,
        numbersToExpressions: true,
        simplify: true,
        stringArrayShuffle: true,
        splitStrings: true,
        stringArrayThreshold: 1
      }
    }),
    terser({
      maxWorkers: 4
    })
  ]
} as RollupOptions;
