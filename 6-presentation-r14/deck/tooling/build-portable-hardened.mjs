import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const deckRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const build = spawnSync(npm, ['run', 'build', '--', '--base=./'], {
  cwd: deckRoot,
  encoding: 'utf8',
  shell: process.platform === 'win32',
})

process.stdout.write(build.stdout || '')
process.stderr.write(build.stderr || '')
if (build.status !== 0) process.exit(build.status || 1)

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

const cssFiles = (await filesUnder(path.join(deckRoot, 'dist')))
  .filter((file) => file.toLowerCase().endsWith('.css'))
const removedImports = []
const remoteImportPatterns = [
  /@import\s+["']https?:\/\/[^"']+["']\s*;/gi,
  /@import\s+url\(\s*["']https?:\/\/[^"']+["']\s*\)\s*;/gi,
  /@import\s+url\(\s*https?:\/\/[^)]+\)\s*;/gi,
]

for (const file of cssFiles) {
  const original = await readFile(file, 'utf8')
  const matches = remoteImportPatterns.flatMap((pattern) => original.match(pattern) || [])
  const hardened = remoteImportPatterns.reduce((text, pattern) => text.replace(pattern, ''), original)
  if (matches.length) {
    await writeFile(file, hardened, 'utf8')
    removedImports.push({
      path: path.relative(deckRoot, file).replaceAll('\\', '/'),
      removedCount: matches.length,
    })
  }
}

const remainingExternalCssDependencies = []
for (const file of cssFiles) {
  const text = await readFile(file, 'utf8')
  const importMatches = [...text.matchAll(/@import\s+[^;]*https?:\/\/[^;]+;/gi)]
  const urlMatches = [...text.matchAll(/url\(\s*["']?https?:\/\/[^)"']+["']?\s*\)/gi)]
  for (const match of [...importMatches, ...urlMatches]) {
    remainingExternalCssDependencies.push({
      path: path.relative(deckRoot, file).replaceAll('\\', '/'),
      value: match[0],
    })
  }
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const result = {
  schemaVersion: '1.0.0',
  workflow: 'npm run build -- --base=./, then remove generated remote CSS imports and fail on external CSS dependencies',
  systemFontSource: 'src/index.css',
  removedImports,
  remainingExternalCssDependencyCount: remainingExternalCssDependencies.length,
  remainingExternalCssDependencies,
  hardenedCss: await Promise.all(cssFiles.map(async (file) => ({
    path: path.relative(deckRoot, file).replaceAll('\\', '/'),
    sha256: sha256(await readFile(file)),
  }))),
  status: remainingExternalCssDependencies.length === 0 ? 'PASS' : 'FAIL',
}

console.log(`HARDENING_RESULT_JSON: ${JSON.stringify(result)}`)
if (result.status !== 'PASS') process.exit(1)
