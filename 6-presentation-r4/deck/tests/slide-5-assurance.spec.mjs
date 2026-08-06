import { expect, test } from '@playwright/test'
import {
  assertSlide5ProductionAtUrl,
  startIsolatedViteServer,
  stopIsolatedViteServer,
} from './helpers/slide-5-browser-assurance.mjs'

test('Slide 5 reviewer orbit satisfies full-cycle browser assurance', async () => {
  let server
  try {
    server = await startIsolatedViteServer({ timeoutMs: 45000 })
    expect(server.port).not.toBe(4174)

    const assurance = await assertSlide5ProductionAtUrl({
      url: `${server.baseUrl}/?slide=4`,
      timeoutMs: 45000,
    })

    expect(assurance.errors, JSON.stringify(assurance.summaries, null, 2)).toEqual([])
    expect(assurance.summaries.default.samples).toBe(104)
    expect(assurance.summaries.system.samples).toBe(104)
    expect(assurance.summaries.reduced.samples).toBe(104)
  } finally {
    await stopIsolatedViteServer(server?.process)
  }
})
