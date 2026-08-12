import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import {
  ArrowRight,
  ClipboardList,
  DatabaseZap,
  FileSearch,
  FlaskConical,
  GitCompareArrows,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import styles from './NextStepsSlide.module.css'

const nextSteps = [
  { id: 'investigate', number: '01', icon: DatabaseZap, title: 'Investigate Stratton data', text: 'Inventory sources, access paths, quality, residency, retention and ownership.' },
  { id: 'map', number: '02', icon: GitCompareArrows, title: 'Map portfolio and reporting formats', text: 'Compare field definitions, templates, exceptions, materiality rules and citation needs.' },
  { id: 'define', number: '03', icon: ClipboardList, title: 'Define a representative POC', text: 'Select an approved non-production subset, accountable owners and measurable success criteria.' },
  { id: 'evaluate', number: '04', icon: FileSearch, title: 'Run and evaluate the POC', text: 'Test ingestion, extraction, retrieval, citations and human decision support against the planned acceptance gates.' },
]

const outcomes = [
  { id: 'proceed', icon: ShieldCheck, label: 'Proceed', text: 'Evidence supports a controlled next increment.' },
  { id: 'refine', icon: RotateCcw, label: 'Refine', text: 'Gaps are addressable through data, controls or design changes.' },
  { id: 'proceed-value-control', icon: TrendingUp, label: 'Proceed', text: 'Proceed when Value or Control justifies further investment.' },
]

export default function NextStepsSlide({ index }) {
  return (
    <Slide index={index} className={styles.nextStepsSlide}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} aria-hidden="true" />
      <div className={`orb ${styles.orb2}`} aria-hidden="true" />

      <div className={`${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />

        <header className={styles.header}>
          <div className={styles.headerText}>
            <Editable as="p" id="closing-next.eyebrow" className={styles.eyebrow}>
              From demonstration to evidence
            </Editable>
            <Editable as="h2" id="closing-next.title" className={styles.title} multiline>
              Next Steps
            </Editable>
            <Editable as="p" id="closing-next.subtitle" className={styles.subtitle} multiline>
              This demonstration used mockup data to show the target experience; it is not evidence of production readiness or achieved business outcomes.
            </Editable>
          </div>

          <Editable as="p" id="closing-next.mockup-badge" className={styles.mockupBadge}>
            MOCKUP DATA USED
          </Editable>
        </header>

        <EditableList
          id="closing-next.roadmap"
          items={nextSteps}
          keyOf={(item) => item.id}
          className={styles.roadmap}
          itemClassName={styles.roadmapItem}
        >
          {(item) => {
            const Icon = item.icon
            return (
              <article className={styles.stepCard} data-roadmap-step={item.id}>
                <div className={styles.stepTop}>
                  <Editable as="span" id={`closing-next.roadmap.${item.id}.number`} className={styles.stepNumber}>
                    {item.number}
                  </Editable>
                  <span className={styles.stepIcon} aria-hidden="true">
                    <Icon strokeWidth={1.75} />
                  </span>
                </div>
                <Editable as="h3" id={`closing-next.roadmap.${item.id}.title`} className={styles.stepTitle} multiline>
                  {item.title}
                </Editable>
                <Editable as="p" id={`closing-next.roadmap.${item.id}.text`} className={styles.stepText} multiline>
                  {item.text}
                </Editable>
                {item.id !== 'evaluate' && <ArrowRight className={styles.stepArrow} aria-hidden="true" strokeWidth={1.6} />}
              </article>
            )
          }}
        </EditableList>

        <section className={styles.pocGate} aria-label="Non-production POC decision gate">
          <div className={styles.pocCopy}>
            <span className={styles.pocIcon} aria-hidden="true">
              <FlaskConical strokeWidth={1.65} />
            </span>
            <div>
              <Editable as="p" id="closing-next.poc.kicker" className={styles.pocKicker}>
                Non-production proof-of-concept gate
              </Editable>
              <Editable as="h3" id="closing-next.poc.title" className={styles.pocTitle} multiline>
                Prove value safely before scale
              </Editable>
              <Editable as="p" id="closing-next.poc.body" className={styles.pocBody} multiline>
                Use a representative Stratton data subset to measure quality, security, performance, operating effort and cost before committing to broader implementation.
              </Editable>
            </div>
          </div>

          <div className={styles.outcomesPanel}>
            <Editable as="p" id="closing-next.outcomes.title" className={styles.outcomesTitle}>
              POC decision options
            </Editable>
            <EditableList
              id="closing-next.outcomes"
              items={outcomes}
              keyOf={(item) => item.id}
              className={styles.outcomeList}
              itemClassName={styles.outcomeItem}
            >
              {(item) => {
                const Icon = item.icon
                return (
                  <article className={styles.outcomeCard}>
                    <span aria-hidden="true">
                      <Icon strokeWidth={1.65} />
                    </span>
                    <Editable as="strong" id={`closing-next.outcomes.${item.id}.label`}>
                      {item.label}
                    </Editable>
                    <Editable as="p" id={`closing-next.outcomes.${item.id}.text`} multiline>
                      {item.text}
                    </Editable>
                  </article>
                )
              }}
            </EditableList>
          </div>
        </section>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="closing-next.footer">Stratton Europe Capital · mockup demonstration to governed next steps</Editable>} />
    </Slide>
  )
}
