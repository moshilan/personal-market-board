import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readStore } from '../src/market-data-store.mjs'
import { buildDashboardResponse } from '../src/dashboard-data.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDirectory, '..')
const outputFlag = process.argv.indexOf('--output')
const outputDirectory = outputFlag === -1
  ? resolve(projectRoot, 'dist')
  : resolve(projectRoot, process.argv[outputFlag + 1] ?? '')

if (!outputDirectory || outputDirectory === projectRoot) throw new Error('请通过--output指定有效的输出目录')

const store = await readStore(resolve(projectRoot, 'data/market-data.json'))
const response = buildDashboardResponse(store)

await rm(outputDirectory, { recursive: true, force: true })
await cp(resolve(projectRoot, 'public'), outputDirectory, { recursive: true })
await mkdir(resolve(outputDirectory, 'api'), { recursive: true })
await writeFile(resolve(outputDirectory, 'api/home.json'), `${JSON.stringify(response)}\n`, 'utf8')

const manifest = JSON.parse(await readFile(resolve(outputDirectory, 'manifest.webmanifest'), 'utf8'))
if (manifest.start_url !== './') throw new Error('PWA清单必须使用相对start_url以支持项目页子路径')

console.log(`静态站点已生成至 ${outputDirectory}`)
