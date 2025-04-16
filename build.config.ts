import { glob, readFile, rm, writeFile } from 'node:fs/promises'
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
      format: 'esm',
      globOptions: {
        // test folders
        ignore: ['**/*.test.ts', '**/*.spec.ts', '**/test/**'],
      },
      cleanDist: true,
      ext: 'mjs',
    },
  ],
  hooks: {
    'build:done': async function (ctx) {
      for await (const file of glob(resolve(ctx.options.outDir, '**/*.d.ts'))) {
        const dtsContents = (await readFile(file, 'utf8')).replaceAll(
          /from ['"]\.\/([^'"]+?)(?:\.ts)?['"];?\s*$/gm,
          (_, relativePath) => ` from "./${relativePath}.mjs";`,
        )
        await writeFile(file.replace(/\.d.ts$/, '.d.mts'), dtsContents)
      }

      for await (const file of glob(resolve(ctx.options.outDir, '**/*.mjs'))) {
        const mjsContents = (await readFile(file, 'utf8')).replaceAll(
          /from ['"]\.\/([^'"]+?)(?:\.ts)?['"];?\s*$/gm,
          (_, relativePath) => ` from "./${relativePath}.mjs";`,
        )
        await writeFile(file, mjsContents)
      }
    },
  },
})
