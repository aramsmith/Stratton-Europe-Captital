import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import styles from './AgenticArchitectureRingSlide.module.css'

const phaseNodes = [
  { id: 'phase-0', phase: 'Phase 0', label: 'Coordinate', x: 50, y: 8, delay: 900, entryX: 0, entryY: -180, rotate: 14 },
  { id: 'phase-1', phase: 'Phase 1', label: 'Requirements', x: 76, y: 19, delay: 1080, entryX: 150, entryY: -150, rotate: 14 },
  { id: 'phase-2', phase: 'Phase 2', label: 'TOGAF Architecture', x: 90, y: 44, delay: 1260, entryX: 180, entryY: -30, rotate: 14 },
  { id: 'phase-3', phase: 'Phase 3', label: 'Azure Design', x: 85, y: 70, delay: 1440, entryX: 160, entryY: 120, rotate: 14 },
  { id: 'phase-4', phase: 'Phase 4', label: 'Implementation Plan', x: 64, y: 88, delay: 1620, entryX: 70, entryY: 170, rotate: 14, compact: true },
  { id: 'phase-5', phase: 'Phase 5', label: 'Coding', x: 36, y: 88, delay: 1800, entryX: -70, entryY: 170, rotate: -14 },
  { id: 'phase-6', phase: 'Phase 6', label: 'ARB Presentation', x: 15, y: 70, delay: 1980, entryX: -160, entryY: 120, rotate: -14 },
  { id: 'phase-7', phase: 'Phase 7', label: 'Deployment', x: 10, y: 44, delay: 2160, entryX: -180, entryY: -30, rotate: -14, optional: true },
  { id: 'phase-8', phase: 'Phase 8', label: 'Runtime Testing', x: 24, y: 19, delay: 2340, entryX: -150, entryY: -150, rotate: -14, optional: true },
]

const reviewers = [
  {
    id: 'rubber-duck',
    title: 'Rubber Duck',
    label: 'Reviewer',
    angle: 180,
    delay: 580,
    entryX: 140,
  },
  {
    id: 'security-compliance',
    title: 'Security & Compliance',
    label: 'Reviewer',
    angle: 0,
    delay: 740,
    entryX: -140,
  },
]

const principles = [
  {
    id: 'human-final',
    title: 'Human-final governance',
    text: 'Both reviewers cover the same artifact hashes before the human approves.',
  },
  {
    id: 'independent-challenge',
    title: 'Independent challenge',
    text: 'Rubber Duck uses a different GPT model; Security and Compliance derives obligations from case evidence.',
  },
  {
    id: 'traceable-outputs',
    title: 'Compact, traceable outputs',
    text: 'One authoritative Markdown document, safe HTML and essential evidence per phase.',
  },
  {
    id: 'azure-ready',
    title: 'Azure-ready, never reckless',
    text: 'Bicep-first, private databases, no stored deployment credentials and no automatic deployment.',
  },
  {
    id: 'fail-closed',
    title: 'Stop when assurance is incomplete',
    text: 'If evidence, scope, independent review, human approval, or output safety cannot be confirmed, the phase does not advance.',
  },
]

export default function AgenticArchitectureRingSlide({ index }) {
  return (
    <Slide index={index} className={styles.agenticArchitectureRing}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      <div className={`${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />

        <header className={styles.header}>
          <Editable as="h2" id="agentic-ring.title" className={styles.title}>
            Architecture is a conversation, not a conveyor belt.
          </Editable>
          <Editable as="p" id="agentic-ring.subtitle" className={styles.subtitle} multiline>
            Agentic Architecture v2 surrounds the human architect with a specialised crew. Each phase creates, challenges, secures, and evidences the work—while every material decision and every gate stays with the human.
          </Editable>
        </header>

        <div className={styles.composition}>
          <figure className={styles.ringPanel} aria-labelledby="agentic-ring-figure-caption">
            <div className={styles.ringCanvas}>
              <svg
                className={styles.ringField}
                viewBox="0 0 600 600"
                aria-hidden="true"
                focusable="false"
              >
                <circle className={styles.outerField} cx="300" cy="300" r="250" />
                <circle className={styles.orbitLine} cx="300" cy="300" r="201" />
                <circle className={styles.assuranceField} cx="300" cy="300" r="160" />
                <circle className={styles.humanRing} cx="300" cy="300" r="112" />
              </svg>

              <div className={styles.architectCore}>
                <svg className={styles.personIcon} viewBox="0 0 80 92" aria-hidden="true" focusable="false">
                  <circle cx="40" cy="24" r="15" />
                  <path d="M12 81c2-24 13-36 28-36s26 12 28 36Z" />
                </svg>
                <Editable as="strong" id="agentic-ring.human.title">Human architect</Editable>
                <Editable as="span" id="agentic-ring.human.role">decision · approval · accountability</Editable>
              </div>

              <EditableList
                id="agentic-ring.phases"
                items={phaseNodes}
                keyOf={(item) => item.id}
                className={styles.phaseNodeLayer}
                itemClassName={styles.phaseNodeShell}
              >
                {(item) => (
                  <article
                    className={`${styles.phaseNode} ${item.optional ? styles.optionalNode : ''} ${item.compact ? styles.compactPhaseNode : ''}`}
                    style={{
                      '--node-x': `${item.x}%`,
                      '--node-y': `${item.y}%`,
                      '--phase-delay': `${item.delay}ms`,
                      '--entry-x': `${item.entryX}px`,
                      '--entry-y': `${item.entryY}px`,
                      '--entry-rotate': `${item.rotate}deg`,
                    }}
                  >
                    <Editable as="span" id={`agentic-ring.phases.${item.id}.phase`}>{item.phase}</Editable>
                    <Editable as="strong" id={`agentic-ring.phases.${item.id}.label`}>{item.label}</Editable>
                  </article>
                )}
              </EditableList>

              <EditableList
                id="agentic-ring.reviewers"
                items={reviewers}
                keyOf={(item) => item.id}
                className={styles.reviewerLayer}
                itemClassName={styles.reviewerNodeShell}
              >
                {(item) => (
                  <div
                    className={styles.reviewerOrbit}
                    style={{
                      '--review-delay': `${item.delay}ms`,
                      '--review-angle': `${item.angle}deg`,
                      '--review-entry-x': `${item.entryX}px`,
                    }}
                  >
                    <article className={styles.reviewerNode}>
                      <Editable as="strong" id={`agentic-ring.reviewers.${item.id}.title`}>{item.title}</Editable>
                      <Editable as="span" id={`agentic-ring.reviewers.${item.id}.label`}>{item.label}</Editable>
                    </article>
                  </div>
                )}
              </EditableList>
            </div>

            <Editable as="figcaption" id="agentic-ring.figure-caption" className={styles.figureCaption}>
              Nine governed phases · two independent reviewers · one accountable human
            </Editable>
          </figure>

          <aside className={styles.principlesPanel}>
            <EditableList
              id="agentic-ring.principles"
              items={principles}
              keyOf={(item) => item.id}
              className={styles.principles}
              itemClassName={styles.principleShell}
            >
              {(item) => (
                <article className={styles.principle}>
                  <Editable as="h3" id={`agentic-ring.principles.${item.id}.title`}>{item.title}</Editable>
                  <Editable as="p" id={`agentic-ring.principles.${item.id}.text`} multiline>{item.text}</Editable>
                </article>
              )}
            </EditableList>
          </aside>
        </div>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="agentic-ring.footer">Stratton Europe Capital · Agentic Architecture operating model</Editable>} />
    </Slide>
  )
}
