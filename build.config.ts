import { glob, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'pathe'
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
      globOptions: {
        // test folders
        ignore: ['**/*.test.ts', '**/*.spec.ts', '**/test/**'],
      },
      cleanDist: true,
    },
  ],
  hooks: {
    'build:done': async function (ctx) {
      for await (const file of glob(resolve(ctx.options.outDir, '**/*.d.ts'))) {
        const mjsContents = (await readFile(file, 'utf8'))
          .replaceAll(
            /^\s*export\s+\*\s+from\s+['"]([^'"]+)['"]/gm,
            (_, relativePath) => `export type * from "${relativePath}"`,
          )
          .replaceAll(
            /\.ts(?!\.d\.ts)/g,
            () => `.d.ts`,
          )
        await writeFile(file, mjsContents)
      }

      for await (const file of glob(resolve(ctx.options.outDir, '**/*.mjs'))) {
        const mjsContents = (await readFile(file, 'utf8')).replaceAll(
          /\.ts(?!\.d\.ts)/g,
          () => `.mjs`,
        )
        await writeFile(file, mjsContents)
      }
    },
  },
})
