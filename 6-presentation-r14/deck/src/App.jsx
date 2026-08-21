import { useEffect } from 'react'
import { InlineEditProvider, Navigation, SlideErrorBoundary, SlideProvider } from '@deckio/deck-engine'
import '@deckio/deck-engine/styles/editable.css'
import { ThemeProvider } from './components/theme-provider'
import Aurora from '@/components/ui/aurora'
import project from '../deck.config.js'
import inlineEdits from './data/inline-edits.json'

// Inline-edit overrides are dev-only. Production builds render the original
// source text and ignore the override map, matching Decision 63's posture.
const overrides = import.meta.env.DEV ? inlineEdits : {}

export default function App() {
  const { accent, id, slides, theme, title, hiddenSlides } = project
  const auroraColors = project.aurora?.colors ?? ['#0ea5e9', '#6366f1', '#8b5cf6']

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent)
    document.title = title
  }, [accent, title])

  return (
    <ThemeProvider defaultTheme="dark">
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <Aurora colorStops={auroraColors} amplitude={1.0} blend={0.5} speed={0.6} />
        </div>
        <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
          <InlineEditProvider overrides={overrides} project={id}>
            <SlideProvider totalSlides={slides.length} project={id} slides={slides} theme={theme} hiddenSlides={hiddenSlides}>
              <Navigation />
              <div className="deck" data-project-id={id}>
                {slides.map((SlideComponent, index) => (
                  <SlideErrorBoundary key={`${id}-slide-${index}`} index={index}>
                    <SlideComponent index={index} project={project} />
                  </SlideErrorBoundary>
                ))}
              </div>
            </SlideProvider>
          </InlineEditProvider>
        </div>
      </div>
    </ThemeProvider>
  )
}
