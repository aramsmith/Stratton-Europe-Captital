import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Earth,
  MessageSquareText,
  Moon,
  Repeat2,
  Sun,
} from 'lucide-react'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import sharedStyles from '../styles/PhaseSummarySlides.module.css'
import styles from './ModelPortfolioSlide.module.css'

const modelTiers = [
  {
    id: 'luna',
    icon: Moon,
    tier: 'Luna',
    model: 'gpt-5.6-luna',
    version: '2026-07-09',
    role: 'Fastest and lowest cost',
    tasks: ['Evidence triage', 'Query rewrite', 'First-pass summary'],
    step: 1,
  },
  {
    id: 'terra',
    icon: Earth,
    tier: 'Terra',
    model: 'gpt-5.6-terra',
    version: '2026-07-09',
    role: 'Default grounded professional model',
    tasks: ['Grounded analysis', 'Cross-document comparison', 'ESG normalisation'],
    step: 2,
  },
  {
    id: 'sol',
    icon: Sun,
    tier: 'Sol',
    model: 'gpt-5.6-sol',
    version: '2026-07-09',
    role: 'Gated frontier reasoning',
    tasks: ['Conflicting evidence', 'Complex risk synthesis', 'Investment-thesis challenge'],
    step: 3,
  },
]

const solutionScopes = [
  {
    id: 'scope',
    label: 'Scope',
    note: 'Release 1 approved · future items require separate architecture and approval',
    items: [
      'Release 1 · Due diligence',
      'Release 1 · Assistive ESG/risk analysis',
      'Future only · Automated SFDR',
      'Future only · Deal intelligence',
      'Future only · Portfolio monitoring',
    ],
  },
]

const aiTechniques = [
  { id: 'prompt-engineering', icon: MessageSquareText, label: 'Prompt Engineering' },
  { id: 'loop-engineering', icon: Repeat2, label: 'Loop Engineering' },
  {
    id: 'graph-engineering-diamond',
    icon: null,
    label: 'Graph Engineering - Diamond',
    diagram: 'diamond',
  },
]

function DiamondGraph() {
  return (
    <svg
      className={styles.diamondGraph}
      viewBox="0 0 114 50"
      role="img"
      aria-label="One input branches into three graph paths and converges into one synthesis"
      data-diamond-graph
    >
      <defs>
        <marker
          id="slide11-diamond-source-arrow"
          viewBox="0 0 6 6"
          refX="5"
          refY="3"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M 0 0 L 6 3 L 0 6 Z" className={styles.diamondSourceArrow} />
        </marker>
        <marker
          id="slide11-diamond-synthesis-arrow"
          viewBox="0 0 6 6"
          refX="5"
          refY="3"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M 0 0 L 6 3 L 0 6 Z" className={styles.diamondSynthesisArrow} />
        </marker>
      </defs>

      <g className={styles.diamondSourceLinks}>
        <path d="M 16 25 L 41 9" markerEnd="url(#slide11-diamond-source-arrow)" />
        <path d="M 16 25 L 41 25" markerEnd="url(#slide11-diamond-source-arrow)" />
        <path d="M 16 25 L 41 41" markerEnd="url(#slide11-diamond-source-arrow)" />
      </g>
      <g className={styles.diamondSynthesisLinks}>
        <path d="M 55 9 L 96 25" markerEnd="url(#slide11-diamond-synthesis-arrow)" />
        <path d="M 55 25 L 96 25" markerEnd="url(#slide11-diamond-synthesis-arrow)" />
        <path d="M 55 41 L 96 25" markerEnd="url(#slide11-diamond-synthesis-arrow)" />
      </g>

      <circle className={styles.diamondEndpoint} cx="9" cy="25" r="7" />
      <circle className={styles.diamondNode} cx="48" cy="9" r="6" />
      <circle className={styles.diamondNode} cx="48" cy="25" r="6" />
      <circle className={styles.diamondNode} cx="48" cy="41" r="6" />
      <circle className={styles.diamondEndpoint} cx="105" cy="25" r="7" />
    </svg>
  )
}

function editableItems(items) {
  return items.map((label) => ({
    id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    label,
  }))
}

export default function ModelPortfolioSlide({ index }) {
  return (
    <Slide index={index} className={`${sharedStyles.phaseSlide} ${styles.modelPortfolioSlide}`}>
      <div className="accent-bar" />
      <div className={`orb ${sharedStyles.orb1}`} />
      <div className={`orb ${sharedStyles.orb2}`} />

      <div className={`${sharedStyles.body} ${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />

        <header className={`${sharedStyles.header} ${styles.header}`}>
          <Editable as="p" id="model-portfolio.eyebrow" className={sharedStyles.eyebrow}>
            Approved model portfolio · Evidence-led escalation
          </Editable>
          <Editable as="h2" id="model-portfolio.title" className={`${sharedStyles.title} ${styles.title}`} multiline>
            Use the smallest approved model that meets the evidence threshold.
          </Editable>
          <Editable as="p" id="model-portfolio.subtitle" className={`${sharedStyles.subtitle} ${styles.subtitle}`} multiline>
            Specialist services handle deterministic work; Luna, Terra and Sol are pinned and promoted only through benchmarked, human-validated gates.
          </Editable>
        </header>

        <div className={styles.modelAndScope}>
          <EditableList
            id="model-portfolio.models"
            items={modelTiers}
            keyOf={(item) => item.id}
            className={styles.modelGrid}
            itemClassName={styles.modelShell}
          >
            {(item) => {
              const ModelIcon = item.icon
              return (
                <div className={styles.modelStage}>
                  <article
                    className={`${styles.modelCard} ${styles[`${item.id}Card`]}`}
                    data-model-tier={item.id}
                  >
                  <div className={styles.modelHeader}>
                    <div>
                      <Editable as="span" id={`model-portfolio.models.${item.id}.sequence`} className={styles.sequence}>
                        Tier {item.step}
                      </Editable>
                        <div className={styles.modelNameRow}>
                          <span className={`${styles.iconBadge} ${styles[`${item.id}Icon`]}`}>
                            <ModelIcon data-model-icon={item.id} aria-hidden="true" strokeWidth={1.8} />
                          </span>
                          <Editable as="h3" id={`model-portfolio.models.${item.id}.tier`} className={styles.modelTier}>
                            {item.tier}
                          </Editable>
                        </div>
                    </div>
                    <BadgeCheck aria-hidden="true" strokeWidth={1.65} />
                  </div>

                  <div className={styles.modelIdentity}>
                    <Editable as="strong" id={`model-portfolio.models.${item.id}.model`}>
                      {item.model}
                    </Editable>
                    <Editable as="span" id={`model-portfolio.models.${item.id}.version`}>
                      {item.version}
                    </Editable>
                  </div>

                  <Editable as="p" id={`model-portfolio.models.${item.id}.role`} className={styles.modelRole} multiline>
                    {item.role}
                  </Editable>

                  <EditableList
                    id={`model-portfolio.models.${item.id}.tasks`}
                    items={editableItems(item.tasks)}
                    keyOf={(task) => task.id}
                    className={styles.taskList}
                    itemClassName={styles.taskShell}
                  >
                    {(task) => (
                      <Editable as="span" id={`model-portfolio.models.${item.id}.tasks.${task.id}`} multiline>
                        {task.label}
                      </Editable>
                    )}
                  </EditableList>
                  </article>

                  {item.id !== 'sol' && (
                    <div className={styles.escalationArrow} aria-hidden="true">
                      <ArrowRight strokeWidth={1.7} />
                    </div>
                  )}
                </div>
              )
            }}
          </EditableList>

          <EditableList
            id="model-portfolio.solution-scope"
            items={solutionScopes}
            keyOf={(item) => item.id}
            className={styles.scopeList}
            itemClassName={styles.scopeShell}
          >
            {(item) => (
              <article
                className={`${styles.scopeCard} ${styles[`${item.id}Scope`]}`}
                data-scope-card="scope"
              >
                <div className={styles.scopeHeading}>
                  <Editable as="strong" id={`model-portfolio.solution-scope.${item.id}.label`}>
                    {item.label}
                  </Editable>
                  <Editable as="span" id={`model-portfolio.solution-scope.${item.id}.note`} multiline>
                    {item.note}
                  </Editable>
                </div>
                <EditableList
                  id={`model-portfolio.solution-scope.${item.id}.items`}
                  items={editableItems(item.items)}
                  keyOf={(scopeItem) => scopeItem.id}
                  className={styles.scopeItems}
                  itemClassName={styles.scopeItemShell}
                >
                  {(scopeItem) => (
                    <Editable as="span" id={`model-portfolio.solution-scope.${item.id}.items.${scopeItem.id}`} multiline>
                      {scopeItem.label}
                    </Editable>
                  )}
                </EditableList>
              </article>
            )}
          </EditableList>
        </div>

        <section className={`${sharedStyles.surface} ${styles.techniquesRail}`}>
          <div className={styles.techniqueLead}>
            <BrainCircuit aria-hidden="true" strokeWidth={1.65} />
            <Editable as="strong" id="model-portfolio.ai-techniques.title">
              AI Techniques used
            </Editable>
          </div>

          <EditableList
            id="model-portfolio.ai-techniques"
            items={aiTechniques}
            keyOf={(item) => item.id}
            className={styles.techniquesList}
            itemClassName={styles.techniqueShell}
          >
            {(item) => {
              const Icon = item.icon
              return (
                <div
                  className={`${styles.techniqueItem} ${item.diagram === 'diamond' ? styles.diamondTechniqueItem : ''}`}
                >
                  {item.diagram === 'diamond' ? (
                    <DiamondGraph />
                  ) : (
                    <Icon aria-hidden="true" strokeWidth={1.65} />
                  )}
                  <Editable as="span" id={`model-portfolio.ai-techniques.${item.id}`} multiline>
                    {item.label}
                  </Editable>
                </div>
              )
            }}
          </EditableList>
        </section>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="model-portfolio.footer">Stratton Europe Capital · Approved model portfolio</Editable>} />
    </Slide>
  )
}
