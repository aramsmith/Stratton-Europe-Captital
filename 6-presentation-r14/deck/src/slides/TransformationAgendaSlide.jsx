import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import styles from './TransformationAgendaSlide.module.css'

const transformationObjectives = [
  { id: 'platform', title: 'Sovereign intelligence platform', text: 'Accelerate diligence, enable real-time monitoring, automate ESG reporting and strengthen deal sourcing.' },
  { id: 'landing-zone', title: 'Sovereign Azure foundation', text: 'Move the legacy on-premises solution into an Azure AI & Sovereign Landing Zone.' },
  { id: 'continuous-ai', title: 'AI-led evolution', text: 'Continuously improve outcomes that will enable Stratton growth\nand development of new services.' },
]

const expectedOutcomes = [
  { id: 'cycle', title: '12 → 3 weeks', text: 'Shorter due-diligence cycle.' },
  { id: 'sfdr', title: 'Fully automated', text: 'SFDR reporting.' },
  { id: 'pipeline', title: '+40%', text: 'Larger deal-sourcing pipeline.' },
  { id: 'anomalies', title: 'Real time', text: 'Portfolio financial-anomaly detection.' },
  { id: 'proof', title: 'Sovereign and evidenced', text: 'New Azure environment\nwith proof of improvement.' },
]

const aiInfusion = [
  {
    id: 'diligence-engine',
    title: 'GenAI due-diligence engine',
    text: 'Analyses financial statements, legal documents and market data to produce structured risk assessments.',
  },
  {
    id: 'esg-extraction',
    title: 'ESG data-extraction AI',
    text: 'Standardises portfolio-company sustainability metrics from unstructured reports.',
  },
  {
    id: 'deal-copilot',
    title: 'Deal-intelligence copilot',
    text: 'Monitors M&A signals, patent filings and regulatory announcements to surface opportunities.',
  },
]

function createGearPath(teeth = 20, outerRadius = 258, rootRadius = 216) {
  const points = []
  const step = (Math.PI * 2) / teeth
  const startAngle = -Math.PI / 2
  const toothProfile = [
    [0, rootRadius],
    [0.12, rootRadius],
    [0.22, outerRadius],
    [0.56, outerRadius],
    [0.68, rootRadius],
  ]

  for (let tooth = 0; tooth < teeth; tooth += 1) {
    for (const [offset, radius] of toothProfile) {
      const angle = startAngle + (tooth + offset) * step
      points.push(`${(Math.cos(angle) * radius).toFixed(2)} ${(Math.sin(angle) * radius).toFixed(2)}`)
    }
  }

  return `M ${points.join(' L ')} Z`
}

const gearPath = createGearPath()

function GearTeeth({ id }) {
  const gradientId = `agenda-gear-${id}`
  const shineId = `agenda-gear-shine-${id}`

  return (
    <svg
      className={styles.gearTeeth}
      viewBox="-250 -250 500 500"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--gear-highlight)" />
          <stop offset="24%" stopColor="var(--gear-start)" />
          <stop offset="58%" stopColor="var(--gear-mid)" />
          <stop offset="100%" stopColor="var(--gear-end)" />
        </linearGradient>
        <linearGradient id={shineId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--gear-highlight)" stopOpacity="0.78" />
          <stop offset="48%" stopColor="var(--gear-mid)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--gear-end)" stopOpacity="0.78" />
        </linearGradient>
      </defs>
      <path className={styles.gearShape} d={gearPath} fill={`url(#${gradientId})`} />
      <circle className={styles.gearOuterRing} r="239" />
      <circle className={styles.gearRing} r="229" stroke={`url(#${shineId})`} />
      <circle className={styles.gearInnerRing} r="220" />
    </svg>
  )
}

export default function TransformationAgendaSlide({ index }) {
  return (
    <Slide index={index} className={styles.transformationAgenda}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      <div className={`${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />
        <header className={styles.header}>
          <Editable as="span" id="agenda.eyebrow" className={styles.eyebrow}>Case Study 18 · Transformation case</Editable>
          <Editable as="h2" id="agenda.title" className={styles.title}>From investment friction to sovereign AI advantage</Editable>
          <Editable as="p" id="agenda.subtitle" className={styles.subtitle} multiline>
            Building from the case challenges, Stratton’s target state connects sovereign Azure transformation to measurable investment outcomes.
          </Editable>
        </header>

        <div className={styles.gearStage}>
          <section className={`${styles.gear} ${styles.sideGear} ${styles.objectiveGear}`}>
            <GearTeeth id="objectives" />
            <div className={styles.gearCore}>
              <Editable as="h3" id="agenda.objectives.title">Transformation objectives</Editable>
              <EditableList
                id="agenda.objectives.items"
                items={transformationObjectives}
                keyOf={(item) => item.id}
                className={styles.areaItems}
                itemClassName={styles.areaItemShell}
              >
                {(item) => (
                  <article className={styles.areaItem}>
                    <Editable as="strong" id={`agenda.objectives.${item.id}.title`}>{item.title}</Editable>
                    <Editable as="p" id={`agenda.objectives.${item.id}.text`} multiline>{item.text}</Editable>
                  </article>
                )}
              </EditableList>
            </div>
          </section>

          <section className={`${styles.gear} ${styles.centreGear} ${styles.aiGear}`}>
            <GearTeeth id="ai" />
            <div className={`${styles.gearCore} ${styles.aiCore}`}>
              <div className={styles.aiHeader}>
                <Editable as="span" id="agenda.ai.eyebrow">AI infusion · the centrepiece</Editable>
                <Editable as="strong" id="agenda.ai.north-star">Make Stratton a frontier AI-driven company</Editable>
              </div>
              <EditableList
                id="agenda.ai.items"
                items={aiInfusion}
                keyOf={(item) => item.id}
                className={styles.aiGrid}
                itemClassName={styles.aiPointShell}
              >
                {(item) => (
                  <article className={styles.aiPoint}>
                    <Editable as="h4" id={`agenda.ai.${item.id}.title`}>{item.title}</Editable>
                    <Editable as="p" id={`agenda.ai.${item.id}.text`}>{item.text}</Editable>
                  </article>
                )}
              </EditableList>
            </div>
          </section>

          <section className={`${styles.gear} ${styles.sideGear} ${styles.outcomeGear}`}>
            <GearTeeth id="outcomes" />
            <div className={styles.gearCore}>
              <Editable as="h3" id="agenda.outcomes.title">Expected outcomes</Editable>
              <EditableList
                id="agenda.outcomes.items"
                items={expectedOutcomes}
                keyOf={(item) => item.id}
                className={styles.areaItems}
                itemClassName={styles.areaItemShell}
              >
                {(item) => (
                  <article className={styles.areaItem}>
                    <Editable as="strong" id={`agenda.outcomes.${item.id}.title`}>{item.title}</Editable>
                    <Editable as="p" id={`agenda.outcomes.${item.id}.text`} multiline>{item.text}</Editable>
                  </article>
                )}
              </EditableList>
            </div>
          </section>
        </div>

        <Editable as="p" id="agenda.sources" className={styles.sources}>
          Source: AMA Case Study 18 · Sovereign AI Platform for a Central European Private Equity Fund
        </Editable>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="agenda.footer">Stratton Europe Capital · Objectives, outcomes and AI infusion</Editable>} />
    </Slide>
  )
}
