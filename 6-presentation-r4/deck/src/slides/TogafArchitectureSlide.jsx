import { BottomBar, Editable, EditableList, Slide, useDisclosure } from '@deckio/deck-engine'
import {
  BriefcaseBusiness,
  Blocks,
  Database,
  FileSearch2,
  Landmark,
  Network,
  Scale,
  ServerCog,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import styles from '../styles/PhaseSummarySlides.module.css'
import slideStyles from './TogafArchitectureSlide.module.css'

const architectureLayers = [
  {
    id: 'context',
    step: 0,
    icon: Network,
    label: 'Context',
    blocks: [
      { id: 'actors', label: 'Deal teams + specialists' },
      { id: 'sources', label: 'Authoritative + licensed sources' },
      { id: 'boundary', label: 'Release 1 boundary' },
      { id: 'authority', label: 'Governance + IC authority' },
    ],
  },
  {
    id: 'business',
    step: 1,
    icon: BriefcaseBusiness,
    label: 'Business',
    blocks: [
      { id: 'eligibility', label: 'Eligibility + jurisdiction' },
      { id: 'registration', label: 'Governed sources + permissions' },
      { id: 'evidence', label: 'Evidence, analysis + citations' },
      { id: 'review', label: 'Review, approval + committee draft' },
    ],
  },
  {
    id: 'application',
    step: 2,
    icon: Blocks,
    label: 'Application',
    blocks: [
      { id: 'case-policy', label: 'Case + policy services' },
      { id: 'ingestion', label: 'Controlled ingestion + provenance' },
      { id: 'analysis', label: 'Assistive analysis + citations' },
      { id: 'workflow', label: 'Workflow, draft + audit evidence' },
    ],
  },
  {
    id: 'data',
    step: 3,
    icon: Database,
    label: 'Data',
    blocks: [
      { id: 'gates', label: 'Source + licence gates' },
      { id: 'envelope', label: 'Quarantine + evidence envelope' },
      { id: 'working', label: 'Working evidence + cited outputs' },
      { id: 'records', label: 'Review, audit + disposition' },
    ],
  },
  {
    id: 'technology',
    step: 4,
    icon: ServerCog,
    label: 'Technology',
    blocks: [
      { id: 'identity', label: 'Identity + review channels' },
      { id: 'services', label: 'Policy, services + controlled work' },
      { id: 'integration', label: 'Private integration + protected stores' },
      { id: 'operations', label: 'Observe, incident + recovery' },
    ],
  },
]

const architectureMetrics = [
  { id: 'status', value: 'APPROVED', label: 'baseline' },
  { id: 'abbs', value: '19', label: 'architecture building blocks' },
  { id: 'views', value: '5', label: 'coherent views' },
  { id: 'decisions', value: '10', label: 'bound decisions' },
  { id: 'traceability', value: '31/31', label: 'Must requirements traced' },
  { id: 'gates', value: '7', label: 'owner-bound gates' },
]

const authoritySatellites = [
  { id: 'deal-review', icon: UserRoundCheck, label: 'Deal professional review' },
  { id: 'specialist-approval', icon: Scale, label: 'Legal + Compliance approval' },
  { id: 'audit-evidence', icon: FileSearch2, label: 'Internal Audit evidence' },
  { id: 'ai-governance', icon: ShieldCheck, label: 'AI Governance oversight' },
]

export default function TogafArchitectureSlide({ index }) {
  const { isRevealed } = useDisclosure(6, { index })
  const hubRevealed = isRevealed(5)

  return (
    <Slide index={index} className={`${styles.phaseSlide} ${slideStyles.togafArchitectureSlide}`}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      <div className={`${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />

        <header className={styles.header}>
          <Editable as="p" id="phase2-togaf.eyebrow" className={styles.eyebrow}>
            Phase 2 · Approved vendor-neutral baseline
          </Editable>
          <Editable as="h2" id="phase2-togaf.title" className={styles.title} multiline>
            Phase 2 - The TOGAF Architecture
          </Editable>
          <Editable as="p" id="phase2-togaf.subtitle" className={`${styles.subtitle} ${slideStyles.subtitle}`} multiline>
            Five connected views form one governed architecture: evidence moves through business, application, data and technology layers while accountable people retain every consequential decision.
          </Editable>
        </header>

        <section
          className={`${slideStyles.architectureStage} ${hubRevealed ? slideStyles.isComplete : ''}`}
          aria-label="Integrated TOGAF architecture"
        >
          <EditableList
            id="phase2-togaf.layers"
            items={architectureLayers}
            keyOf={(layer) => layer.id}
            className={slideStyles.layerStack}
            itemClassName={slideStyles.layerShell}
          >
            {(layer) => {
              const LayerIcon = layer.icon
              return (
                <article
                  className={[
                    slideStyles.layer,
                    slideStyles[layer.id],
                    isRevealed(layer.step) ? slideStyles.isRevealed : slideStyles.isMuted,
                  ].join(' ')}
                >
                  <div className={slideStyles.layerIdentity}>
                    <LayerIcon aria-hidden="true" strokeWidth={1.7} />
                    <Editable as="strong" id={`phase2-togaf.layers.${layer.id}.label`}>
                      {layer.label}
                    </Editable>
                  </div>
                  <EditableList
                    id={`phase2-togaf.layers.${layer.id}.blocks`}
                    items={layer.blocks}
                    keyOf={(block) => block.id}
                    className={slideStyles.layerBlocks}
                    itemClassName={slideStyles.blockShell}
                  >
                    {(block) => (
                      <div className={slideStyles.layerBlock}>
                        <Editable as="span" id={`phase2-togaf.layers.${layer.id}.blocks.${block.id}`}>
                          {block.label}
                        </Editable>
                      </div>
                    )}
                  </EditableList>
                  <span className={slideStyles.layerConnector} aria-hidden="true" />
                </article>
              )
            }}
          </EditableList>

          <aside
            className={`${slideStyles.authorityHub} ${hubRevealed ? slideStyles.isRevealed : slideStyles.isMuted}`}
            aria-label="Retained human authority"
          >
            <Editable as="span" id="phase2-togaf.authority.eyebrow" className={slideStyles.hubEyebrow}>
              Retained human authority
            </Editable>
            <div className={slideStyles.hubOrbit} aria-hidden="true" />
            <div className={slideStyles.hubCore}>
              <Landmark aria-hidden="true" strokeWidth={1.6} />
              <Editable as="strong" id="phase2-togaf.authority.core" multiline>
                Investment Committee makes the decision
              </Editable>
            </div>
            <EditableList
              id="phase2-togaf.authority.satellites"
              items={authoritySatellites}
              keyOf={(item) => item.id}
              className={slideStyles.satellites}
              itemClassName={slideStyles.satelliteShell}
            >
              {(item) => {
                const SatelliteIcon = item.icon
                return (
                  <div className={slideStyles.satellite}>
                    <SatelliteIcon aria-hidden="true" strokeWidth={1.65} />
                    <Editable as="span" id={`phase2-togaf.authority.satellites.${item.id}`}>
                      {item.label}
                    </Editable>
                  </div>
                )
              }}
            </EditableList>
            <Editable as="p" id="phase2-togaf.authority.boundary" className={slideStyles.authorityBoundary} multiline>
              No autonomous investment decision · no source-system write-back
            </Editable>
          </aside>
        </section>

        <EditableList
          id="phase2-togaf.metrics"
          items={architectureMetrics}
          keyOf={(item) => item.id}
          className={slideStyles.metricsRibbon}
          itemClassName={slideStyles.metricShell}
        >
          {(item) => (
            <div className={slideStyles.metric}>
              <Editable as="strong" id={`phase2-togaf.metrics.${item.id}.value`}>
                {item.value}
              </Editable>
              <Editable as="span" id={`phase2-togaf.metrics.${item.id}.label`}>
                {item.label}
              </Editable>
            </div>
          )}
        </EditableList>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="phase2-togaf.footer">Stratton Europe Capital · Phase 2 TOGAF architecture</Editable>} />
    </Slide>
  )
}
