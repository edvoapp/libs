import postcss from 'rollup-plugin-postcss';
import sourcemaps from 'rollup-plugin-sourcemaps';
// import typescript from '@rollup/plugin-typescript';
import typescript from 'rollup-plugin-typescript2';
// TODO: fix babel compilation
// import babel, { getBabelOutputPlugin } from '@rollup/plugin-babel'
// import svgi from 'rollup-plugin-svgi'
import alias from '@rollup/plugin-alias';

export default {
  input: 'src/index.ts',
  makeAbsoluteExternalsRelative: true,
  preserveEntrySignatures: 'strict',
  output: {
    dir: './dist',
    // format: 'cjs',
    sourcemap: true,
    generatedCode: {
      reservedNamesAsProps: false,
    },
    interop: 'compat',
    systemNullSetters: false,
    // plugins: [
    //   getBabelOutputPlugin({
    //     presets: ['@babel/preset-env'],
    //     babelHelpers: 'runtime',
    //     plugins: [
    //       [
    //         '@babel/plugin-transform-react-jsx',
    //         {
    //           pragma: 'h',
    //           pragmaFrag: 'Fragment',
    //         },
    //       ],
    //     ],
    //   }),
    // ],
  },
  plugins: [
    // svgi({
    //   options: {
    //     jsx: 'preact',
    //   },
    // }),
    typescript({
      check: true,
    }),
    sourcemaps(),
    postcss({
      extract: true,
      modules: false,
      use: ['sass'],
    }),
    alias({
      entries: [
        { find: 'react', replacement: 'preact/compat' },
        { find: 'react-dom', replacement: 'preact/compat' },
      ],
    }),
    // babel({
    //   babelHelpers: 'runtime',
    //   plugins: [
    //     [
    //       '@babel/plugin-transform-react-jsx',
    //       {
    //         pragma: 'h',
    //         pragmaFrag: 'Fragment',
    //       },
    //     ],
    //   ],
    // }),
  ],
  watch: {
    clearScreen: false,
  },
};
