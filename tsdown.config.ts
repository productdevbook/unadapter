import { defineConfig } from 'tsdown'
import packagejson from './package.json' with { type: 'json' }

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/adapters/create/index.ts',
    'src/adapters/drizzle/index.ts',
    'src/adapters/kysely/index.ts',
    'src/adapters/memory/index.ts',
    'src/adapters/mongodb/index.ts',
    'src/adapters/prisma/index.ts',
    'src/types/index.ts',
    'src/db/index.ts',
    'src/utils/index.ts',
  ],
  format: 'esm',
  treeshake: true,
  target: 'es2022',
  fixedExtension: true,
  clean: true,
  dts: true,
  platform: 'node',
  external: [
    ...Object.keys(packagejson.devDependencies),
    ...Object.keys(packagejson.dependencies),
  ],
})
