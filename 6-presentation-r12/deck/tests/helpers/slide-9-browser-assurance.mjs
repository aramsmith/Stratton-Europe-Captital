import { chromium } from '@playwright/test'

export const slide9MinimumActivatedListItems = 31

const removedAuthorityText = [
  'retained human authority',
  'investment committee makes the decision',
  'deal professional review',
  'legal + compliance approval',
  'internal audit evidence',
  'ai governance oversight',
  'no autonomous investment decision',
  'no source-system write-back',
]

function withTimeout(promise, timeoutMs, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function closeQuietly(resource, label, cleanupErrors) {
  if (!resource) return
  try {
    await resource.close()
  } catch (error) {
    cleanupErrors.push(`${label} cleanup failed: ${error.message}`)
  }
}

async function inspectMode({ url, mode, timeoutMs, screenshotPath }) {
  const reduced = mode === 'reduced'
  let browser
  let context
  let page
  const cleanupErrors = []
  try {
    browser = await withTimeout(
      chromium.launch({ headless: true, timeout: timeoutMs }),
      timeoutMs,
      `${mode} Chromium launch`,
    )
    context = await withTimeout(
      browser.newContext({
        viewport: { width: 1440, height: 900 },
        reducedMotion: reduced ? 'reduce' : 'no-preference',
      }),
      timeoutMs,
      `${mode} context creation`,
    )
    page = await withTimeout(context.newPage(), timeoutMs, `${mode} page creation`)
    page.setDefaultTimeout(timeoutMs)
    page.setDefaultNavigationTimeout(timeoutMs)
    const consoleIssues = []
    const pageErrors = []
    page.on('console', (message) => {
      if (!['error', 'warning'].includes(message.type())) return
      const text = message.text()
      if (/GL Driver Message .*GPU stall due to ReadPixels/.test(text)) return
      consoleIssues.push(`${message.type()}: ${text}`)
    })
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await withTimeout(
      page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs }),
      timeoutMs,
      `${mode} navigation`,
    )
    await page.evaluate(async ({ mode: selectedMode }) => {
      document.documentElement.dataset.fontMode = selectedMode === 'system' ? 'system' : 'jetbrains'
      await document.fonts?.ready
    }, { mode })
    await withTimeout(
      page.waitForFunction(
        (minimum) => (
          document.querySelector('.slide.active')
          && document.querySelectorAll('.slide.active .deckio-list-item').length >= minimum
        ),
        slide9MinimumActivatedListItems,
        { timeout: timeoutMs },
      ),
      timeoutMs,
      `${mode} inline-edit list activation`,
    )

    const result = await page.evaluate(({ mode: selectedMode, minimum, forbiddenText }) => {
      const errors = []
      const active = document.querySelector('.slide.active')
      const normalise = (value) => value.replace(/\s+/g, ' ').trim().toLowerCase()
      const activeText = normalise(active?.textContent ?? '')
      const wrapperCount = active?.querySelectorAll('.deckio-list-item').length ?? 0
      if (!active) errors.push('Slide 9 active slide must exist')
      if (wrapperCount < minimum) {
        errors.push(`Slide 9 must reach at least ${minimum} activated list wrappers, got ${wrapperCount}`)
      }
      for (const text of forbiddenText) {
        if (activeText.includes(text)) errors.push(`removed authority text must be absent: ${text}`)
      }
      if (active?.querySelector('[aria-label="Retained human authority"]')) {
        errors.push('removed retained-human-authority panel must be absent')
      }

      const stage = active?.querySelector('[aria-label="Integrated TOGAF architecture"]')
      const layerStack = active?.querySelector(
        '[data-slide9-region="architecture-layers"], [class*="_layerStack_"]',
      )
      const metrics = active?.querySelector(
        '[data-slide9-region="architecture-metrics"], [class*="_metricsRibbon_"]',
      )
      if (!stage || !layerStack || !metrics) {
        errors.push('Slide 9 architecture stage, layer stack and metrics must exist')
      }

      const rect = (element) => element?.getBoundingClientRect()
      const stageRect = rect(stage)
      const stackRect = rect(layerStack)
      const metricsRect = rect(metrics)
      const widthUse = stageRect && stackRect ? stackRect.width / stageRect.width : 0
      if (widthUse < 0.98) {
        errors.push(`Slide 9 layer stack must use the freed width, ratio ${widthUse.toFixed(3)}`)
      }
      if (stageRect && metricsRect && Math.min(stageRect.bottom, metricsRect.bottom) - Math.max(stageRect.top, metricsRect.top) > 0.5) {
        errors.push('Slide 9 architecture stage must not overlap the metrics ribbon')
      }

      const layerCards = [
        ...active?.querySelectorAll(
          '[data-deckio-field^="phase2-togaf.layers."][data-deckio-field$=".label"]',
        ) ?? [],
      ].map((element) => element.closest('article')).filter(Boolean)
      if (layerCards.length !== 5) {
        errors.push(`Slide 9 must retain five architecture layer cards, got ${layerCards.length}`)
      }
      const intersectionArea = (left, right) => (
        Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
        * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top))
      )
      for (let left = 0; left < layerCards.length; left += 1) {
        for (let right = left + 1; right < layerCards.length; right += 1) {
          if (intersectionArea(rect(layerCards[left]), rect(layerCards[right])) > 0.5) {
            errors.push(`Slide 9 architecture layers ${left + 1} and ${right + 1} must not overlap`)
          }
        }
      }

      const visibleLayerFields = [
        ...layerStack?.querySelectorAll('[data-deckio-field]') ?? [],
      ].filter((element) => {
        const style = getComputedStyle(element)
        const elementRect = rect(element)
        return (
          style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number.parseFloat(style.opacity || '1') > 0.01
          && elementRect.width > 0.5
          && elementRect.height > 0.5
        )
      })
      const outOfBoundsFields = visibleLayerFields
        .filter((element) => {
          const elementRect = rect(element)
          return (
            elementRect.left < stageRect.left - 1
            || elementRect.top < stageRect.top - 1
            || elementRect.right > stageRect.right + 1
            || elementRect.bottom > stageRect.bottom + 1
          )
        })
        .map((element) => element.getAttribute('data-deckio-field'))
      if (outOfBoundsFields.length > 0) {
        errors.push(`Slide 9 layer text must remain inside the architecture stage: ${outOfBoundsFields.join(', ')}`)
      }

      const documentOverflow = [
        document.documentElement.scrollWidth - window.innerWidth,
        document.documentElement.scrollHeight - window.innerHeight,
      ]
      if (documentOverflow[0] > 1 || documentOverflow[1] > 1) {
        errors.push(`Slide 9 document must not overflow, got ${documentOverflow.join(',')}`)
      }

      return {
        mode: selectedMode,
        wrapperCount,
        layerCount: layerCards.length,
        widthUse,
        outOfBoundsFields,
        documentOverflow,
        removedAuthorityTextAbsent: forbiddenText.every((text) => !activeText.includes(text)),
        errors: [...new Set(errors)],
      }
    }, {
      mode,
      minimum: slide9MinimumActivatedListItems,
      forbiddenText: removedAuthorityText,
    })
    result.consoleIssues = consoleIssues
    result.pageErrors = pageErrors
    if (consoleIssues.length > 0) {
      result.errors.push(`${mode} browser console must have zero warnings/errors, got ${consoleIssues.length}`)
    }
    if (pageErrors.length > 0) {
      result.errors.push(`${mode} browser page errors must be zero, got ${pageErrors.length}`)
    }
    if (screenshotPath) {
      await page.screenshot({ path: screenshotPath })
    }
    return result
  } finally {
    await closeQuietly(page, 'page', cleanupErrors)
    await closeQuietly(context, 'context', cleanupErrors)
    await closeQuietly(browser, 'browser', cleanupErrors)
    if (cleanupErrors.length > 0) throw new Error(cleanupErrors.join('; '))
  }
}

export async function assertSlide9DevAtUrl({ url, timeoutMs = 45000, screenshotPath } = {}) {
  const summaries = {}
  const errors = []
  for (const mode of ['default', 'system', 'reduced']) {
    const summary = await inspectMode({
      url,
      mode,
      timeoutMs,
      screenshotPath: mode === 'default' ? screenshotPath : undefined,
    })
    summaries[mode] = summary
    errors.push(...summary.errors)
  }
  return { errors: [...new Set(errors)], summaries }
}
