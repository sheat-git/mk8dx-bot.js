import { BuildOptions, buildSync } from 'esbuild'
import { existsSync, rmdirSync } from 'fs'

const outdir = 'build'

if (existsSync(outdir)) {
    rmdirSync(outdir, { recursive: true })
}

const isDev = process.env.NODE_ENV === 'development'
const config: BuildOptions = {
    entryPoints: ['src/main.ts', 'src/client.ts'],
    bundle: true,
    platform: 'node',
    outdir,
    sourcemap: isDev,
    minify: !isDev,
    treeShaking: true,
    external: ['@napi-rs/canvas*'],
}

buildSync(config)
