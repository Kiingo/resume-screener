import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import obfuscator from 'rollup-plugin-obfuscator';

const isProduction = process.env.NODE_ENV === 'production';
export default {
  input: 'src/index.ts',  // Replace with your entry TypeScript file
  output: [
    {
      file: 'dist/bundle.esm.js',
      format: 'esm'
    },
    {
      file: 'dist/bundle.cjs.js',
      format: 'cjs'
    }
  ],
  plugins: [
    typescript({
        tsconfig: isProduction ? './tsconfig.prod.json' : './tsconfig.dev.json',
    }),
    resolve(),
    commonjs({
        sourceMap: !isProduction,
    }),
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
			},
		}),
  ]
};
