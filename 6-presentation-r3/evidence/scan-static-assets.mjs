import { createHash } from 'node:crypto'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const evidenceDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(evidenceDir, '..')
const dist = path.join(root, 'deck', 'dist')
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(target))
    else files.push(target)
  }
  return files
}

const files = await filesUnder(dist)
const inventory = []
const externalDependencies = []
const localDependencies = []
const jsUrlStrings = []

for (const file of files) {
  const bytes = await readFile(file)
  const relative = path.relative(root, file).replaceAll('\\', '/')
  inventory.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) })
  const extension = path.extname(file).toLowerCase()
  if (!['.css', '.html', '.svg', '.js'].includes(extension)) continue
  const text = bytes.toString('utf8')

  if (extension === '.css') {
    const values = [
      ...[...text.matchAll(/@import\s+([^;]+);/gi)].map((match) => ({ kind: 'css-import', value: match[1] })),
      ...[...text.matchAll(/url\(\s*["']?([^)"']+)["']?\s*\)/gi)].map((match) => ({ kind: 'css-url', value: match[1] })),
    ]
    for (const item of values) {
      if (/^https?:\/\//i.test(item.value)) {
        externalDependencies.push({ path: relative, ...item })
      } else if (!/^(data:|#)/i.test(item.value)) {
        const resolved = path.resolve(path.dirname(file), item.value)
        let exists = false
        try { exists = (await stat(resolved)).isFile() } catch {}
        localDependencies.push({
          path: relative,
          ...item,
          resolvedPath: path.relative(root, resolved).replaceAll('\\', '/'),
          exists,
        })
      }
    }
  }

  if (extension === '.html' || extension === '.svg') {
    for (const match of text.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
      if (/^https?:\/\//i.test(match[1])) {
        externalDependencies.push({ path: relative, kind: `${extension.slice(1)}-reference`, value: match[1] })
      }
    }
  }

  if (extension === '.js') {
    const urls = [...new Set([...text.matchAll(/https?:\/\/[^\s"'`<>\\)]+/gi)].map((match) => match[0]))]
    for (const value of urls) {
      jsUrlStrings.push({
        path: relative,
        value,
        classification: 'STATIC_ENGINE_OR_LIBRARY_STRING_NOT_AN_OBSERVED_RUNTIME_CALL',
      })
    }
  }
}

const result = {
  schemaVersion: '1.0.0',
  recordType: 'AFF_PHASE_6_RECURSIVE_STATIC_ASSET_EVIDENCE',
  modelPlanRevision: '18',
  root: 'deck/dist',
  fileCount: inventory.length,
  inventory: inventory.sort((a, b) => a.path.localeCompare(b.path)),
  sourceMapCount: inventory.filter((item) => item.path.endsWith('.map')).length,
  externalDependencyCount: externalDependencies.length,
  externalDependencies,
  localDependencies,
  allLocalDependenciesExist: localDependencies.every((item) => item.exists),
  productionInertUrlStrings: jsUrlStrings,
  productionInertUrlStringCount: jsUrlStrings.length,
  interpretation:
    'JavaScript URL strings are static engine/library mechanics unless observed as requests. ' +
    'The runtime network receipt is authoritative for actual calls. No licensing conclusion is made.',
  overallStatus:
    externalDependencies.length === 0 &&
    localDependencies.every((item) => item.exists) &&
    inventory.filter((item) => item.path.endsWith('.map')).length === 0
      ? 'PASS'
      : 'FAIL',
}

await writeFile(
  path.join(evidenceDir, 'recursive-static-asset-scan.json'),
  `${JSON.stringify(result, null, 2)}\n`,
  'utf8',
)
console.log(JSON.stringify({
  fileCount: result.fileCount,
  externalDependencyCount: result.externalDependencyCount,
  allLocalDependenciesExist: result.allLocalDependenciesExist,
  productionInertUrlStringCount: result.productionInertUrlStringCount,
  overallStatus: result.overallStatus,
}, null, 2))
if (result.overallStatus !== 'PASS') process.exit(1)
