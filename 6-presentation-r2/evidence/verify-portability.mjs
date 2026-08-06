import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from '../deck/node_modules/puppeteer/lib/puppeteer/puppeteer.js'

const evidenceDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(evidenceDir, '..')
const dist = path.join(root, 'deck', 'dist')
const indexPath = path.join(dist, 'index.html')
const index = await readFile(indexPath, 'utf8')
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const references = [...index.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1])
const localReferences = references.filter((value) => !value.startsWith('http:') && !value.startsWith('https:'))
const rootAbsoluteReferences = localReferences.filter((value) => value.startsWith('/'))
const resolvedReferences = []

for (const value of localReferences) {
  const resolved = path.resolve(dist, value)
  let exists = false
  let fileSha256 = null
  try {
    exists = (await stat(resolved)).isFile()
    if (exists) fileSha256 = sha256(await readFile(resolved))
  } catch {}
  resolvedReferences.push({
    reference: value,
    resolvedPath: path.relative(root, resolved).replaceAll('\\', '/'),
    exists,
    sha256: fileSha256,
  })
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

const server = createServer(async (request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const target = path.resolve(root, `.${requestPath}`)
  if (!target.startsWith(root)) {
    response.writeHead(403).end('Forbidden')
    return
  }
  try {
    const bytes = await readFile(target)
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(target)] || 'application/octet-stream' })
    response.end(bytes)
  } catch {
    response.writeHead(404).end('Not found')
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const failedRequests = []
page.on('requestfailed', (request) => {
  failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' })
})
const nestedUrl = `http://127.0.0.1:${port}/deck/dist/index.html`
const response = await page.goto(nestedUrl, { waitUntil: 'networkidle0', timeout: 30000 })
await page.waitForSelector('.slide', { timeout: 15000 })
const slideCount = await page.$$eval('.slide', (slides) => slides.length)
await browser.close()
await new Promise((resolve) => server.close(resolve))

const result = {
  schemaVersion: '1.0.0',
  recordType: 'AFF_PHASE_6_BROWSER_PORTABILITY_EVIDENCE',
  modelPlanRevision: '17',
  buildCommand: 'npm run build -- --base=./',
  indexPath: 'deck/dist/index.html',
  indexSha256: sha256(await readFile(indexPath)),
  localReferences,
  rootAbsoluteReferenceCount: rootAbsoluteReferences.length,
  rootAbsoluteReferences,
  resolvedReferences,
  allReferencedLocalFilesExist: resolvedReferences.every((item) => item.exists),
  nestedHttpTest: {
    path: '/deck/dist/index.html',
    httpStatus: response.status(),
    slideCount,
    failedRequests,
  },
  overallStatus:
    rootAbsoluteReferences.length === 0 &&
    resolvedReferences.every((item) => item.exists) &&
    response.status() === 200 &&
    slideCount === 10 &&
    failedRequests.length === 0
      ? 'PASS'
      : 'FAIL',
}

await writeFile(
  path.join(evidenceDir, 'browser-portability.json'),
  `${JSON.stringify(result, null, 2)}\n`,
  'utf8',
)

console.log(JSON.stringify(result, null, 2))
if (result.overallStatus !== 'PASS') process.exit(1)
