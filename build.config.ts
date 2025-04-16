import { defineBuildConfig } from 'unbuild'
import packagejson from './package.json'

export default defineBuildConfig({
  rollup: {
    emitCJS: false,
    esbuild: {
      treeShaking: true,
    },
  },
  declaration: 'node16',
  outDir: 'dist',
  clean: true,
  failOnWarn: false,
  externals: [
    ...Object.keys(packagejson.devDependencies),
    ...Object.keys(packagejson.dependencies),
  ],
  entries: [
    {
      input: './src/',
      outDir: './dist/',
      format: 'esm',
      globOptions: {
        // test folders
        ignore: ['**/*.test.ts', '**/*.spec.ts', '**/test/**'],
      },
      cleanDist: true,
    },
  ],
})
