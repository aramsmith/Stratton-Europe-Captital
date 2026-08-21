import { useEffect, useSyncExternalStore } from 'react'
import { useSlides } from '@deckio/deck-engine'
import styles from './PresentationStatus.module.css'

const DURATION_SECONDS = 40 * 60
const FONT_MODE_REFERENCE = 'jetbrains'
const FONT_MODE_SYSTEM = 'system'
const FONT_STORAGE_KEY = 'stratton-r4-font-mode'
const FONT_MODES = new Set([FONT_MODE_REFERENCE, FONT_MODE_SYSTEM])

let timerState = Object.freeze({
  remainingSeconds: DURATION_SECONDS,
  running: false,
  started: false,
})
let deadline = 0
let intervalId = null
const listeners = new Set()
const fontModeListeners = new Set()

function readStoredFontMode() {
  if (typeof window === 'undefined') return FONT_MODE_REFERENCE

  try {
    const storedMode = window.localStorage.getItem(FONT_STORAGE_KEY)
    return FONT_MODES.has(storedMode) ? storedMode : FONT_MODE_REFERENCE
  } catch (error) {
    console.warn('[Stratton deck] Unable to read the saved font preference.', error)
    return FONT_MODE_REFERENCE
  }
}

let fontMode = readStoredFontMode()

function applyFontMode(nextMode) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.fontMode = nextMode
  }
}

applyFontMode(fontMode)

function emit(nextState) {
  timerState = Object.freeze(nextState)
  listeners.forEach((listener) => listener())
}

function clearTimer() {
  if (intervalId !== null) {
    window.clearInterval(intervalId)
    intervalId = null
  }
}

function updateRemaining() {
  if (!timerState.running) return

  const remainingSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
  if (remainingSeconds !== timerState.remainingSeconds) {
    emit({ remainingSeconds, running: remainingSeconds > 0, started: true })
  }
  if (remainingSeconds === 0) clearTimer()
}

function startTimer() {
  if (timerState.running) return

  const remainingSeconds = timerState.remainingSeconds || DURATION_SECONDS
  deadline = Date.now() + remainingSeconds * 1000
  emit({ remainingSeconds, running: true, started: true })
  intervalId = window.setInterval(updateRemaining, 250)
}

function pauseTimer() {
  if (!timerState.running) return

  updateRemaining()
  clearTimer()
  emit({
    remainingSeconds: timerState.remainingSeconds,
    running: false,
    started: timerState.started,
  })
}

function setFullscreenActive(active) {
  if (!active) {
    pauseTimer()
    return
  }

  if (timerState.started) startTimer()
}

function startAfterFirstSlide(displayIndex) {
  if (displayIndex > 0 && !timerState.started) startTimer()
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return timerState
}

function subscribeFontMode(listener) {
  fontModeListeners.add(listener)
  return () => fontModeListeners.delete(listener)
}

function getFontModeSnapshot() {
  return fontMode
}

function setFontMode(nextMode) {
  if (!FONT_MODES.has(nextMode) || nextMode === fontMode) return

  fontMode = nextMode
  applyFontMode(nextMode)

  try {
    window.localStorage.setItem(FONT_STORAGE_KEY, nextMode)
  } catch (error) {
    console.warn('[Stratton deck] Unable to save the font preference.', error)
  }

  fontModeListeners.forEach((listener) => listener())
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

if (import.meta.hot) {
  import.meta.hot.dispose(clearTimer)
}

export default function PresentationStatus({ index }) {
  const {
    displayIndex,
    isFullscreen,
    totalSlides,
    visibleCount,
    visibleIndices,
  } = useSlides()
  const { remainingSeconds, running, started } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  )
  const activeFontMode = useSyncExternalStore(
    subscribeFontMode,
    getFontModeSnapshot,
    getFontModeSnapshot,
  )

  useEffect(() => {
    setFullscreenActive(isFullscreen)
  }, [isFullscreen])

  useEffect(() => {
    startAfterFirstSlide(displayIndex)
  }, [displayIndex])

  const visiblePosition = visibleIndices.indexOf(index)
  const slideNumber = visiblePosition >= 0 ? visiblePosition + 1 : index + 1
  const slideTotal = visiblePosition >= 0 ? visibleCount : totalSlides
  const formattedTime = formatTime(remainingSeconds)
  const usingSystemFont = activeFontMode === FONT_MODE_SYSTEM
  const fontToggleLabel = usingSystemFont
    ? 'Switch to the local reference mono font'
    : 'Switch to the original system font'

  return (
    <div className={styles.status} aria-hidden="false">
      <button
        type="button"
        className={styles.fontToggle}
        data-font-mode={activeFontMode}
        aria-label={fontToggleLabel}
        title={`${fontToggleLabel}. Current font: ${usingSystemFont ? 'system font' : 'local reference mono font'}.`}
        onClick={() => setFontMode(
          usingSystemFont ? FONT_MODE_REFERENCE : FONT_MODE_SYSTEM,
        )}
      >
        <span aria-hidden="true">Aa</span>
      </button>
      <span
        className={styles.slideNumber}
        aria-label={`Slide ${slideNumber} of ${slideTotal}`}
      >
        {String(slideNumber).padStart(2, '0')} / {String(slideTotal).padStart(2, '0')}
      </span>
      <span
        className={styles.timer}
        data-running={running}
        data-expired={remainingSeconds === 0}
        data-started={started}
        role="timer"
        aria-live="off"
        aria-label={
          started
            ? `${Math.floor(remainingSeconds / 60)} minutes ${remainingSeconds % 60} seconds remaining`
            : `Countdown starts after slide 1; ${Math.floor(remainingSeconds / 60)} minutes ${remainingSeconds % 60} seconds remaining`
        }
      >
        {formattedTime}
      </span>
    </div>
  )
}
