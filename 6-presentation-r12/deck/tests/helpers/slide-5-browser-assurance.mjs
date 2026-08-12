import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

export const slide5CycleMs = 26000
export const slide5OrbitDelayMs = 3000
export const slide5SampleStepMs = 250
export const slide5SampleTimes = Array.from({ length: slide5CycleMs / slide5SampleStepMs }, (_, index) => index * slide5SampleStepMs)
export const slide5ExpectedRadius = 326

const helperDir = path.dirname(fileURLToPath(import.meta.url))
export const deckDir = path.resolve(helperDir, '..', '..')

export const slide5UnsafeCssMutations = [
  { name: 'prior unsafe-radius-cascade', css: '.reviewerOrbit { --review-orbit-radius: 201px; }', expected: ['effective orbit radius must be 326px', 'full-cycle effective orbit radius must render at 326px'] },
  { name: 'prior same-position-cascade', css: `.reviewerNodeShell:nth-child(2) .reviewerOrbit {
  --review-angle: 180deg !important;
}`, expected: 'effective reviewer positions must remain 180 degrees apart' },
  { name: 'prior counter-clockwise-keyframe-override', css: `@keyframes reviewerOrbit {
  from { transform: translate(-50%, -50%) rotate(var(--review-angle)) translateX(var(--review-orbit-radius)); }
  to { transform: translate(-50%, -50%) rotate(calc(var(--review-angle) - 360deg)) translateX(var(--review-orbit-radius)); }
}`, expected: 'effective orbit must move clockwise' },
  { name: 'prior counter-rotation-disabled', css: `.agenticArchitectureRing:global(.active) .reviewerOrbit .reviewerNode {
  animation: reviewerConverge 850ms ease var(--review-delay) both !important;
}`, expected: 'effective node animation must include reviewerCounterOrbit' },
  { name: 'prior reduced-motion-reenabled', css: `@media (prefers-reduced-motion: reduce) {
  .agenticArchitectureRing:global(.active) .reviewerOrbit { animation: reviewerOrbit 26s linear infinite !important; }
}`, expected: 'reduced-motion effective orbit animation must be none' },
  { name: 'extra unsafe-transform-calc', css: `.reviewerOrbit {
  transform: translate(-50%, -50%) rotate(var(--review-angle)) translateX(calc(200px + 1px));
}`, expected: 'full-cycle effective orbit radius must render at 326px' },
  { name: 'extra same-position-direct-transform', css: `.reviewerNodeShell:nth-child(2) .reviewerOrbit {
  transform: translate(-50%, -50%) rotate(180deg) translateX(var(--review-orbit-radius));
}`, expected: 'effective reviewer positions must remain 180 degrees apart' },
  { name: 'extra animation-direction-reverse', css: `.agenticArchitectureRing:global(.active).agenticArchitectureRing .reviewerOrbit {
  animation: reviewerOrbit 26s linear 3000ms infinite reverse;
}`, expected: ['effective orbit direction must be normal clockwise', 'effective orbit must move clockwise'] },
  { name: 'extra counter-disabled-specificity', css: `.agenticArchitectureRing:global(.active).agenticArchitectureRing .reviewerOrbit .reviewerNode {
  animation: reviewerConverge 850ms ease var(--review-delay) both;
}`, expected: 'effective node animation must include reviewerCounterOrbit' },
  { name: 'extra reduced-animation-name', css: `@media (prefers-reduced-motion: reduce) {
  .agenticArchitectureRing:global(.active).agenticArchitectureRing .reviewerOrbit {
    animation-name: reviewerOrbit;
    animation-duration: 26s;
    animation-iteration-count: infinite;
  }
}`, expected: 'reduced-motion effective orbit animation must be none' },
  { name: 'new midcycle-radius-collapse', css: `@keyframes reviewerOrbit {
  0% { transform: translate(-50%, -50%) rotate(var(--review-angle)) translateX(var(--review-orbit-radius)); }
  3.8461538462% { transform: translate(-50%, -50%) rotate(calc(var(--review-angle) + 13.8461538462deg)) translateX(var(--review-orbit-radius)); }
  50% { transform: translate(-50%, -50%) rotate(calc(var(--review-angle) + 180deg)) translateX(201px); }
  100% { transform: translate(-50%, -50%) rotate(calc(var(--review-angle) + 360deg)) translateX(var(--review-orbit-radius)); }
}`, expected: 'full-cycle effective orbit radius must render at 326px' },
  { name: 'new midcycle-counter-tilt', css: `@keyframes reviewerCounterOrbit {
  0% { transform: translate(-50%, -50%) rotate(calc(var(--review-angle) * -1)); }
  3.8461538462% { transform: translate(-50%, -50%) rotate(calc((var(--review-angle) + 13.8461538462deg) * -1)); }
  50% { transform: translate(-50%, -50%) rotate(calc((var(--review-angle) + 180deg) * -1 + 32deg)); }
  100% { transform: translate(-50%, -50%) rotate(calc((var(--review-angle) + 360deg) * -1)); }
}`, expected: 'full-cycle effective counter-rotation must keep content upright' },
  { name: 'new reduced-static-tilt', css: `@media (prefers-reduced-motion: reduce) {
  .reviewerOrbit .reviewerNode { transform: translate(-50%, -50%) rotate(calc(var(--review-angle) * -1 + 90deg)); }
}`, expected: 'reduced-motion reviewer content must keep content upright' },
  { name: 'new reviewers-invisible', css: `.reviewerNode {
  opacity: 0 !important;
}`, expected: 'reviewer nodes must remain visible and distinguishable' },
  { name: 'new orbit-play-state-paused', css: `.reviewerOrbit {
  animation-play-state: paused !important;
}`, expected: 'effective orbit animation must be running' },
]

export function appendSlide5MutationCss(candidate, mutation) {
  return { ...candidate, css: `${candidate.css}\n${mutation.css}\n` }
}

export function normaliseSlide5CssForBrowser(css) {
  return css.replace(/:global\(([^)]+)\)/g, '$1').replace(/@import[^;]+;/g, '')
}

export function buildSlide5EffectiveCssHarness(css) {
  const phaseNodes = [
    ['phase-0', 'Phase 0', 'Coordinate', 50, 8], ['phase-1', 'Phase 1', 'Requirements', 76, 19],
    ['phase-2', 'Phase 2', 'TOGAF Architecture', 90, 44], ['phase-3', 'Phase 3', 'Azure Design', 85, 70],
    ['phase-4', 'Phase 4', 'Implementation Plan', 64, 88], ['phase-5', 'Phase 5', 'Coding', 36, 88],
    ['phase-6', 'Phase 6', 'C-level Presentation', 15, 70], ['phase-7', 'Phase 7', 'Deployment', 10, 44],
    ['phase-8', 'Phase 8', 'Runtime Testing', 24, 19],
  ].map(([id, phase, label, x, y]) => `<div class="phaseNodeShell"><article class="phaseNode" style="--node-x:${x}%; --node-y:${y}%; --phase-delay:900ms; --entry-x:0; --entry-y:0; --entry-rotate:0deg;"><span data-deckio-field="agentic-ring.phases.${id}.phase">${phase}</span><strong data-deckio-field="agentic-ring.phases.${id}.label">${label}</strong></article></div>`).join('\n')

  return `<!doctype html><html><head><meta charset="utf-8" /><style>
:root { --deck-canvas-width: 1440px; --deck-canvas-height: 900px; --pink: #ec4899; --cyan: #22d3ee; --purple: #8b5cf6; --purple-deep: #312e81; --blue-glow: #38bdf8; --foreground: #f8fafc; --background: #020617; --secondary: #111827; --border: rgba(148, 163, 184, 0.32); --muted-foreground: #94a3b8; --secondary-foreground: #e5e7eb; --font-family-mono: "JetBrains Mono", monospace; --font-weight-semibold: 600; --font-weight-bold: 700; --letter-spacing-tight: -0.02em; --radius-lg: 18px; --shadow-elevated: none; --glow-cyan: rgba(34, 211, 238, 0.38); }
* { box-sizing: border-box; } html, body { margin: 0; width: 1440px; height: 900px; overflow: hidden; background: #020617; font-family: var(--font-family-mono); } .content-frame { width: 1280px; margin-inline: auto; } .content-gutter { padding-inline: 72px; } .accent-bar, .orb { display: none; } .agenticArchitectureRing.active { position: relative; width: 1440px; height: 900px; } .deck-bottom-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 44px; }
${normaliseSlide5CssForBrowser(css)}
</style></head><body><section class="agenticArchitectureRing active"><div class="body content-frame content-gutter"><header class="header"><h2 class="title" data-deckio-field="agentic-ring.title">Architecture is a conversation, not a conveyor belt.</h2></header><div class="composition"><figure class="ringPanel" aria-labelledby="agentic-ring-figure-caption"><div class="ringCanvas"><svg class="ringField" viewBox="0 0 600 600" aria-hidden="true"><circle class="outerField" cx="300" cy="300" r="250" /><circle class="orbitLine" cx="300" cy="300" r="201" /><circle class="assuranceField" cx="300" cy="300" r="160" /><circle class="humanRing" cx="300" cy="300" r="112" /></svg><div class="architectCore"><strong data-deckio-field="agentic-ring.human.title">Human architect</strong><span>decision · approval · accountability</span></div><div class="phaseNodeLayer">${phaseNodes}</div><div class="reviewerLayer"><div class="reviewerNodeShell"><div id="rubber-orbit" class="reviewerOrbit" style="--review-delay: 580ms; --review-angle: 180deg; --review-entry-x: 140px;"><article id="rubber-node" class="reviewerNode"><strong data-deckio-field="agentic-ring.reviewers.rubber-duck.title">Rubber Duck</strong><span data-deckio-field="agentic-ring.reviewers.rubber-duck.label">Reviewer</span></article></div></div><div class="reviewerNodeShell"><div id="security-orbit" class="reviewerOrbit" style="--review-delay: 740ms; --review-angle: 0deg; --review-entry-x: -140px;"><article id="security-node" class="reviewerNode"><strong data-deckio-field="agentic-ring.reviewers.security-compliance.title">Security &amp; Compliance</strong><span data-deckio-field="agentic-ring.reviewers.security-compliance.label">Reviewer</span></article></div></div></div></div><figcaption id="agentic-ring-figure-caption" class="figureCaption" data-deckio-field="agentic-ring.figure-caption">Nine governed phases · two independent reviewers · one accountable human</figcaption></figure></div></div><div class="deck-bottom-bar"><span data-deckio-field="agentic-ring.footer">Stratton Europe Capital · Agentic Architecture operating model</span></div></section></body></html>`
}

function withTimeout(promise, timeoutMs, label) {
  let timer
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs) })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function closeQuietly(resource, label, cleanupErrors) {
  if (!resource) return
  try { await resource.close() } catch (error) { cleanupErrors.push(`${label} cleanup failed: ${error.message}`) }
}

async function withIsolatedPage({ viewport = { width: 1440, height: 900 }, reducedMotion = 'no-preference', timeoutMs = 30000 } = {}, fn) {
  let browser, context, page
  const cleanupErrors = []
  try {
    browser = await withTimeout(chromium.launch({ headless: true, timeout: timeoutMs }), timeoutMs, 'Chromium launch')
    context = await withTimeout(browser.newContext({ viewport, reducedMotion }), timeoutMs, 'Chromium context creation')
    context.setDefaultTimeout(timeoutMs)
    context.setDefaultNavigationTimeout(timeoutMs)
    page = await withTimeout(context.newPage(), timeoutMs, 'Chromium page creation')
    page.setDefaultTimeout(timeoutMs)
    page.setDefaultNavigationTimeout(timeoutMs)
    const result = await fn(page)
    return { result, cleanupErrors }
  } finally {
    await closeQuietly(page, 'page', cleanupErrors)
    await closeQuietly(context, 'context', cleanupErrors)
    await closeQuietly(browser, 'browser', cleanupErrors)
  }
}

export async function assertSlide5EffectiveCss({ css, timeoutMs = 30000 } = {}) {
  const errors = []
  const summaries = {}
  for (const mode of ['default', 'reduced']) {
    const reduced = mode === 'reduced'
    try {
      const { result, cleanupErrors } = await withIsolatedPage({ viewport: { width: 1440, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference', timeoutMs }, async (page) => {
        await withTimeout(page.setContent(buildSlide5EffectiveCssHarness(css), { waitUntil: 'load', timeout: timeoutMs }), timeoutMs, `${mode} content load`)
        return withTimeout(page.evaluate(slide5PageEvaluation, { mode, samples: slide5SampleTimes, geometry: false }), timeoutMs, `${mode} effective CSS evaluation`)
      })
      summaries[mode] = result
      errors.push(...result.errors)
      if (cleanupErrors.length > 0) errors.push(...cleanupErrors)
    } catch (error) { errors.push(`${mode} effective CSS browser validation failed: ${error.message}`) }
  }
  return { errors, summaries }
}

export async function assertSlide5ProductionAtUrl({ url, timeoutMs = 45000 } = {}) {
  const errors = []
  const summaries = {}
  for (const mode of ['default', 'system', 'reduced']) {
    const reduced = mode === 'reduced'
    try {
      const { result, cleanupErrors } = await withIsolatedPage({ viewport: { width: 1440, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference', timeoutMs }, async (page) => {
        const consoleIssues = []
        const pageErrors = []
        page.on('console', (message) => {
          if (!['error', 'warning'].includes(message.type())) return
          const text = message.text()
          if (/GL Driver Message .*GPU stall due to ReadPixels/.test(text)) return
          consoleIssues.push(`${message.type()}: ${text}`)
        })
        page.on('pageerror', (error) => pageErrors.push(error.message))
        await withTimeout(page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs }), timeoutMs, `${mode} navigation`)
        await page.evaluate(async ({ mode }) => { document.documentElement.dataset.fontMode = mode === 'system' ? 'system' : 'jetbrains'; await document.fonts?.ready }, { mode })
        await withTimeout(
          page.waitForFunction(() => document.querySelectorAll('.deckio-list-item').length >= 9, null, { timeout: timeoutMs }),
          timeoutMs,
          `${mode} inline-edit list activation`,
        )
        const evaluation = await withTimeout(page.evaluate(slide5PageEvaluation, { mode, samples: slide5SampleTimes, geometry: true }), timeoutMs, `${mode} production evaluation`)
        evaluation.consoleIssues = consoleIssues
        evaluation.pageErrors = pageErrors
        if (consoleIssues.length > 0) evaluation.errors.push(`${mode} browser console must have zero warnings/errors, got ${consoleIssues.length}`)
        if (pageErrors.length > 0) evaluation.errors.push(`${mode} browser page errors must be zero, got ${pageErrors.length}`)
        return evaluation
      })
      summaries[mode] = result
      errors.push(...result.errors)
      if (cleanupErrors.length > 0) errors.push(...cleanupErrors)
    } catch (error) { errors.push(`${mode} production browser validation failed: ${error.message}`) }
  }
  return { errors, summaries }
}

function slide5PageEvaluation({ mode, samples, geometry }) {
  const expectedRadius = 326
  const orbitDelay = 3000
  const errors = []
  const normalise = (delta) => { let result = delta; while (result <= -180) result += 360; while (result > 180) result -= 360; return result }
  const byField = (field) => document.querySelector(`[data-deckio-field="${field}"]`)
  const reviewerInfo = [
    { id: 'rubber-duck', titleField: 'agentic-ring.reviewers.rubber-duck.title', labelField: 'agentic-ring.reviewers.rubber-duck.label' },
    { id: 'security-compliance', titleField: 'agentic-ring.reviewers.security-compliance.title', labelField: 'agentic-ring.reviewers.security-compliance.label' },
  ]
  const reviewerNodes = reviewerInfo.map((info) => byField(info.titleField)?.closest('article'))
  const reviewerOrbits = reviewerNodes.map((node) => node?.parentElement)
  const ringCanvas = reviewerOrbits[0]?.closest('figure')?.querySelector('[class*="ringCanvas"], .ringCanvas') ?? reviewerOrbits[0]?.closest('figure')?.firstElementChild
  const centerRect = ringCanvas?.getBoundingClientRect()
  const center = centerRect ? { x: centerRect.left + centerRect.width / 2, y: centerRect.top + centerRect.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  const phaseNodes = [...document.querySelectorAll('[data-deckio-field^="agentic-ring.phases."][data-deckio-field$=".label"]')].map((node) => node.closest('article')).filter(Boolean)
  const core = byField('agentic-ring.human.title')?.closest('div')
  const caption = byField('agentic-ring.figure-caption')
  const header = byField('agentic-ring.title')?.closest('header') ?? byField('agentic-ring.title')
  const footerField = byField('agentic-ring.footer')
  const bottomBar = (() => {
    let element = footerField
    while (element?.parentElement) {
      const rect = element.parentElement.getBoundingClientRect()
      if (rect.width > window.innerWidth * 0.75 && rect.bottom > window.innerHeight - 4) return element.parentElement
      element = element.parentElement
    }
    return footerField?.closest('.deck-bottom-bar') ?? footerField
  })()
  if (reviewerNodes.some((node) => !node) || reviewerOrbits.some((node) => !node)) errors.push('both reviewer nodes and orbit shells must exist')
  if (geometry && phaseNodes.length !== 9) errors.push(`nine phase nodes must be present, got ${phaseNodes.length}`)
  const rectCenter = (element) => { const rect = element.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height, rect } }
  const angleOf = (point) => Math.atan2(point.y - center.y, point.x - center.x) * 180 / Math.PI
  const matrixFor = (element) => { const transform = getComputedStyle(element).transform; return transform && transform !== 'none' ? new DOMMatrixReadOnly(transform) : new DOMMatrixReadOnly() }
  const totalRotation = (orbit, node) => { const total = matrixFor(orbit).multiply(matrixFor(node)); return Math.atan2(total.b, total.a) * 180 / Math.PI }
  const effectiveOpacity = (element) => { let opacity = 1; let current = element; while (current && current.nodeType === Node.ELEMENT_NODE) { opacity *= Number.parseFloat(getComputedStyle(current).opacity || '1'); current = current.parentElement } return opacity }
  const rectIntersectionArea = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  const circlePenetration = (a, b) => { const ac = rectCenter(a); const bc = rectCenter(b); return Math.max(0, Math.min(ac.width, ac.height) / 2 + Math.min(bc.width, bc.height) / 2 - Math.hypot(ac.x - bc.x, ac.y - bc.y)) }
  const insideViewport = (rect) => rect.left >= -0.5 && rect.top >= -0.5 && rect.right <= window.innerWidth + 0.5 && rect.bottom <= window.innerHeight + 0.5
  const setAnimations = (elapsed) => {
    for (const animation of document.getAnimations({ subtree: true })) {
      const target = animation.effect?.target
      const isReviewerMotion = target && (reviewerOrbits.includes(target) || reviewerNodes.includes(target))
      try { animation.pause(); animation.currentTime = isReviewerMotion ? orbitDelay + elapsed : 100000 } catch {}
    }
  }
  const readSample = (elapsed) => {
    setAnimations(elapsed)
    const reviewerStates = reviewerNodes.map((node, index) => {
      const orbit = reviewerOrbits[index]
      const point = rectCenter(node)
      const style = getComputedStyle(node)
      const orbitStyle = getComputedStyle(orbit)
      return { id: reviewerInfo[index].id, title: byField(reviewerInfo[index].titleField)?.textContent?.trim() ?? '', label: byField(reviewerInfo[index].labelField)?.textContent?.trim() ?? '', point, angle: angleOf(point), radius: Math.hypot(point.x - center.x, point.y - center.y), totalRotation: totalRotation(orbit, node), visible: style.display !== 'none' && style.visibility !== 'hidden' && effectiveOpacity(node) > 0.95 && point.rect.width > 1 && point.rect.height > 1, orbitPlayState: orbitStyle.animationPlayState, orbitAnimationName: orbitStyle.animationName, orbitAnimationDuration: orbitStyle.animationDuration, orbitAnimationDelay: orbitStyle.animationDelay, orbitAnimationDirection: orbitStyle.animationDirection, orbitAnimationIterationCount: orbitStyle.animationIterationCount, orbitRadiusVariable: orbitStyle.getPropertyValue('--review-orbit-radius').trim(), nodeAnimationName: style.animationName, nodeAnimationDuration: style.animationDuration, nodeAnimationIterationCount: style.animationIterationCount, beforeAnimationName: getComputedStyle(node, '::before').animationName, afterAnimationName: getComputedStyle(node, '::after').animationName }
    })
    return { elapsed, reviewerStates }
  }
  const sampleResults = samples.map(readSample)
  const allStates = sampleResults.map((sample) => sample.reviewerStates)
  const first = allStates[0] ?? []
  const activeMode = mode !== 'reduced'
  for (const [index, state] of first.entries()) {
    if (state.orbitRadiusVariable !== '326px') errors.push(`reviewer ${index + 1} effective orbit radius must be 326px`)
    if (activeMode) {
      if (!state.orbitAnimationName.split(',').map((entry) => entry.trim()).some((entry) => entry.includes('reviewerOrbit'))) errors.push(`reviewer ${index + 1} effective orbit animation must be reviewerOrbit`)
      if (state.orbitAnimationDuration.trim() !== '26s') errors.push(`reviewer ${index + 1} effective orbit duration must be 26s`)
      if (state.orbitAnimationDelay.trim() !== '3s') errors.push(`reviewer ${index + 1} effective orbit delay must be 3000ms`)
      if (state.orbitAnimationIterationCount.trim() !== 'infinite') errors.push(`reviewer ${index + 1} effective orbit must repeat infinitely`)
      if (state.orbitAnimationDirection.trim() !== 'normal') errors.push(`reviewer ${index + 1} effective orbit direction must be normal clockwise, not reverse`)
      if (state.orbitPlayState.split(',').map((entry) => entry.trim()).includes('paused')) errors.push(`reviewer ${index + 1} effective orbit animation must be running`)
      if (!state.nodeAnimationName.split(',').map((entry) => entry.trim()).some((entry) => entry.includes('reviewerCounterOrbit'))) errors.push(`reviewer ${index + 1} effective node animation must include reviewerCounterOrbit`)
      if (!state.nodeAnimationDuration.split(',').map((entry) => entry.trim()).includes('26s')) errors.push(`reviewer ${index + 1} effective counter-rotation duration must include 26s`)
      if (!state.nodeAnimationIterationCount.split(',').map((entry) => entry.trim()).includes('infinite')) errors.push(`reviewer ${index + 1} effective counter-rotation must repeat infinitely`)
    } else {
      if (!state.orbitAnimationName.split(',').map((entry) => entry.trim()).every((entry) => entry === 'none')) errors.push(`reviewer ${index + 1} reduced-motion effective orbit animation must be none`)
      if (!state.nodeAnimationName.split(',').map((entry) => entry.trim()).every((entry) => entry === 'none')) errors.push(`reviewer ${index + 1} reduced-motion effective node animation must be none`)
      if (state.beforeAnimationName !== 'none') errors.push(`reviewer ${index + 1} reduced-motion sphere surface animation must be none`)
      if (state.afterAnimationName !== 'none') errors.push(`reviewer ${index + 1} reduced-motion meridian animation must be none`)
    }
  }
  let maxSeparationError = 0, maxUprightError = 0, radiusMin = Number.POSITIVE_INFINITY, radiusMax = 0, minClockwiseDelta = Number.POSITIVE_INFINITY, maxClockwiseDelta = 0, collisions = 0, minCaptionClearance = Number.POSITIVE_INFINITY
  for (let sampleIndex = 0; sampleIndex < allStates.length; sampleIndex += 1) {
    const states = allStates[sampleIndex]
    if (states.length !== 2) continue
    const separation = Math.abs(normalise(states[1].angle - states[0].angle))
    maxSeparationError = Math.max(maxSeparationError, Math.abs(separation - 180))
    if (Math.abs(separation - 180) > 0.35) errors.push(`${mode} effective reviewer positions must remain 180 degrees apart at ${sampleResults[sampleIndex].elapsed}ms, got ${separation.toFixed(3)}`)
    for (const [index, state] of states.entries()) {
      radiusMin = Math.min(radiusMin, state.radius); radiusMax = Math.max(radiusMax, state.radius)
      if (Math.abs(state.radius - expectedRadius) > 0.85) errors.push(`reviewer ${index + 1} full-cycle effective orbit radius must render at 326px at ${sampleResults[sampleIndex].elapsed}ms, got ${state.radius.toFixed(3)}`)
      const upright = Math.abs(normalise(state.totalRotation)); maxUprightError = Math.max(maxUprightError, upright)
      const uprightPrefix = activeMode ? 'full-cycle effective counter-rotation' : 'reduced-motion reviewer content'
      if (upright > 0.6) errors.push(`reviewer ${index + 1} ${uprightPrefix} must keep content upright at ${sampleResults[sampleIndex].elapsed}ms, error ${upright.toFixed(3)} degrees`)
      if (!state.visible || !state.title || !state.label || state.title === states[1 - index]?.title) errors.push(`reviewer nodes must remain visible and distinguishable at ${sampleResults[sampleIndex].elapsed}ms`)
      if (geometry) {
        if (!insideViewport(state.point.rect)) { errors.push(`reviewer ${index + 1} must stay inside the viewport at ${sampleResults[sampleIndex].elapsed}ms`); collisions += 1 }
        for (const phase of phaseNodes) { if (circlePenetration(reviewerNodes[index], phase) > 0.5) { errors.push(`reviewer ${index + 1} must not collide with phase nodes at ${sampleResults[sampleIndex].elapsed}ms`); collisions += 1; break } }
        for (const [label, element] of [['core', core], ['caption', caption], ['header', header], ['bottom bar', bottomBar]]) { if (element && rectIntersectionArea(state.point.rect, element.getBoundingClientRect()) > 0.5) { errors.push(`reviewer ${index + 1} must not collide with ${label} at ${sampleResults[sampleIndex].elapsed}ms`); collisions += 1 } }
        if (index === 0 && states[1] && circlePenetration(reviewerNodes[0], reviewerNodes[1]) > 0.5) { errors.push(`reviewers must not collide at ${sampleResults[sampleIndex].elapsed}ms`); collisions += 1 }
      }
    }
    if (geometry && caption && bottomBar) { const clearance = bottomBar.getBoundingClientRect().top - caption.getBoundingClientRect().bottom; minCaptionClearance = Math.min(minCaptionClearance, clearance); if (clearance <= 0) errors.push(`caption must keep positive clearance above the bottom bar, got ${clearance.toFixed(3)}px`) }
    if (activeMode && sampleIndex > 0) {
      for (let index = 0; index < 2; index += 1) { const delta = normalise(states[index].angle - allStates[sampleIndex - 1][index].angle); minClockwiseDelta = Math.min(minClockwiseDelta, delta); maxClockwiseDelta = Math.max(maxClockwiseDelta, delta); if (delta < 3.1 || delta > 3.8) errors.push(`reviewer ${index + 1} effective orbit must move clockwise by about 3.462 degrees per quarter-second at ${sampleResults[sampleIndex].elapsed}ms, got ${delta.toFixed(3)}`) }
    }
    if (!activeMode && sampleIndex > 0) {
      for (let index = 0; index < 2; index += 1) { const delta = Math.abs(normalise(states[index].angle - allStates[0][index].angle)); if (delta > 0.1) errors.push(`reduced-motion reviewers must remain static at ${sampleResults[sampleIndex].elapsed}ms, moved ${delta.toFixed(3)} degrees`) }
    }
  }
  const documentOverflow = [document.documentElement.scrollWidth - window.innerWidth, document.documentElement.scrollHeight - window.innerHeight]
  if (geometry && (documentOverflow[0] > 1 || documentOverflow[1] > 1)) errors.push(`document must not overflow viewport, got ${documentOverflow.join(',')}`)
  return { mode, samples: sampleResults.length, errors: [...new Set(errors)], radiusRange: [radiusMin, radiusMax], maxSeparationError, maxUprightError, clockwiseQuarterSecondDelta: activeMode ? [minClockwiseDelta, maxClockwiseDelta] : [0, 0], collisionCount: collisions, captionBottomBarClearance: minCaptionClearance, documentOverflow }
}

export async function findUnusedPort() {
  return new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const address = server.address(); const port = typeof address === 'object' && address ? address.port : null; server.close(() => port ? resolve(port) : reject(new Error('No port allocated'))) }) })
}

export async function startIsolatedViteServer({ port, timeoutMs = 45000 } = {}) {
  const chosenPort = port ?? await findUnusedPort()
  if (chosenPort === 4174) return startIsolatedViteServer({ timeoutMs })
  const command = process.execPath
  const args = [
    path.join(deckDir, 'node_modules', 'vite', 'bin', 'vite.js'),
    '--host',
    '127.0.0.1',
    '--port',
    String(chosenPort),
    '--strictPort',
  ]
  const child = spawn(command, args, { cwd: deckDir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  const output = []
  child.stdout.on('data', (chunk) => output.push(chunk.toString()))
  child.stderr.on('data', (chunk) => output.push(chunk.toString()))
  const baseUrl = `http://127.0.0.1:${chosenPort}`
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode != null) throw new Error(`Vite exited early with ${child.exitCode}: ${output.join('')}`)
    try { const response = await fetch(`${baseUrl}/?slide=4`); if (response.ok) return { port: chosenPort, baseUrl, process: child, output } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  await stopIsolatedViteServer(child)
  throw new Error(`Vite did not become ready on ${baseUrl} within ${timeoutMs}ms: ${output.join('')}`)
}

export async function stopIsolatedViteServer(child) {
  if (!child || child.exitCode != null) return
  child.kill('SIGTERM')
  const exited = await Promise.race([new Promise((resolve) => child.once('exit', () => resolve(true))), new Promise((resolve) => setTimeout(() => resolve(false), 5000))])
  if (!exited && child.exitCode == null) child.kill('SIGKILL')
}
