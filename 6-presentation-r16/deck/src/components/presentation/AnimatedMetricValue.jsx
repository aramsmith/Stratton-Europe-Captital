import { useEffect, useRef, useState } from 'react'
import { Editable, useSlides } from '@deckio/deck-engine'

function useSlideActivation(index) {
  const { current } = useSlides()
  const isActive = current === index
  const [activations, setActivations] = useState(isActive ? 1 : 0)
  const wasActive = useRef(isActive)

  useEffect(() => {
    if (isActive && !wasActive.current) {
      setActivations((value) => value + 1)
    }
    wasActive.current = isActive
  }, [isActive])

  return { activations, isActive }
}

function formatNumber(value, decimals, separator) {
  const [whole, fraction] = value.toFixed(decimals).split('.')
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
  return fraction ? `${groupedWhole}.${fraction}` : groupedWhole
}

export default function AnimatedMetricValue({
  index,
  editableId,
  to,
  from = 0,
  duration = 1500,
  delay = 0,
  decimals = 0,
  prefix = '',
  suffix = '',
  separator = ',',
}) {
  const { activations, isActive } = useSlideActivation(index)
  const [value, setValue] = useState(from)
  const frameRef = useRef(null)

  useEffect(() => {
    if (!isActive) {
      setValue(from)
      return undefined
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(to)
      return undefined
    }

    setValue(from)
    let startTime = null
    let cancelled = false

    const timeoutId = window.setTimeout(() => {
      const tick = (timestamp) => {
        if (cancelled) return

        if (startTime === null) startTime = timestamp
        const progress = Math.min(1, (timestamp - startTime) / duration)
        const easedProgress = 1 - ((1 - progress) ** 3)
        setValue(from + ((to - from) * easedProgress))

        if (progress < 1) {
          frameRef.current = window.requestAnimationFrame(tick)
        }
      }

      frameRef.current = window.requestAnimationFrame(tick)
    }, delay)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [activations, delay, duration, from, isActive, to])

  const formattedValue = `${prefix}${formatNumber(value, decimals, separator)}${suffix}`
  const finalValue = `${prefix}${formatNumber(to, decimals, separator)}${suffix}`

  return (
    <Editable as="strong" id={editableId} aria-label={finalValue}>
      {formattedValue}
    </Editable>
  )
}
