import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import {
  ArrowRight,
  Boxes,
  GitBranch,
  KeyRound,
  Network,
  PackageCheck,
  Radar,
  ShieldAlert,
  UserCheck,
} from 'lucide-react'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import styles from '../styles/PhaseSummarySlides.module.css'
import slideStyles from './ImplementationPlanSlide.module.css'

const deliveryBands = [
  { id: 'foundation', step: '01', icon: Boxes, title: 'Foundation', units: 'Guardrails · organisation', text: 'Hierarchy · guardrails · resource organisation' },
  { id: 'network', step: '02', icon: Network, title: 'Network + identity', units: 'Hubs/spokes · DNS · RBAC', text: 'Hubs/spokes · DNS · deterministic RBAC' },
  { id: 'governance', step: '03', icon: Radar, title: 'Governance + data', units: 'Policy · monitoring · recovery', text: 'Policy · monitoring · SQL/storage recovery' },
  { id: 'platform', step: '04', icon: GitBranch, title: 'Integration + AI + apps', units: 'APIM/Bus · regional AI · apps', text: 'APIM/Bus · regional AI · application platform' },
  { id: 'release', step: '05', icon: PackageCheck, title: 'Lockdown + assurance', units: 'Private endpoints · evidence', text: 'Private endpoints · ingress · evidence · diagnostics' },
]

const planMetrics = [
  { id: 'units', value: '17', label: 'deployable units' },
  { id: 'edges', value: '46', label: 'verified dependency links' },
  { id: 'work', value: '5 + 8', label: 'base/authority + model WPs' },
  { id: 'trace', value: '31/31', label: 'Must requirements bound' },
]

const releaseGates = [
  {
    id: 'owners',
    icon: KeyRound,
    title: 'Required owner inputs',
    text: 'Accountable owners provide tenant, region, identity, network, commercial and operating values; missing inputs stop delivery.',
  },
  {
    id: 'validate',
    icon: ShieldAlert,
    title: 'Validation + what-if',
    text: 'Every stage stops on policy, compilation, security, dependency, or authorized what-if failure.',
  },
  {
    id: 'human',
    icon: UserCheck,
    title: 'Human release',
    text: 'Explicit scope approval is required before optional Azure execution.',
  },
]

export default function ImplementationPlanSlide({ index }) {
  return (
    <Slide index={index} className={`${styles.phaseSlide} ${styles.planSlide} ${slideStyles.implementationPlanSlide}`}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      <div className={`${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />

        <header className={styles.header}>
          <Editable as="p" id="phase4-plan.eyebrow" className={styles.eyebrow}>
            Phase 4 · Bicep-first delivery blueprint
          </Editable>
          <Editable as="h2" id="phase4-plan.title" className={styles.title} multiline>
            Phase 4 - Implementation plan
          </Editable>
          <Editable as="p" id="phase4-plan.subtitle" className={styles.subtitle} multiline>
            The approved Azure design becomes one modular package, deployed only in dependency-safe sequence.
          </Editable>
        </header>

        <section className={[styles.surface, styles.deliveryMap, slideStyles.deliveryMap].join(' ')}>
          <div className={styles.panelLead}>
            <div>
              <Editable as="p" id="phase4-plan.map.kicker" className={styles.panelKicker}>Dependency-controlled delivery map</Editable>
              <Editable as="h3" id="phase4-plan.map.title">Foundation first. Lockdown before release.</Editable>
            </div>
            <span className={styles.dependencyBadge}>
              <GitBranch aria-hidden="true" strokeWidth={1.7} />
              <Editable as="span" id="phase4-plan.map.edges">46 verified dependency links</Editable>
            </span>
          </div>

          <EditableList
            id="phase4-plan.bands"
            items={deliveryBands}
            keyOf={(item) => item.id}
            className={styles.deliveryBands}
            itemClassName={styles.deliveryBandShell}
          >
            {(item) => {
              const Icon = item.icon
              return (
                <div className={styles.deliveryBandWrap}>
                  <article className={[styles.deliveryBand, slideStyles.deliveryBand].join(' ')}>
                    <div className={styles.bandTop}>
                      <Editable as="span" id={`phase4-plan.bands.${item.id}.step`} className={styles.bandStep}>{item.step}</Editable>
                      <span className={styles.bandIcon} aria-hidden="true"><Icon strokeWidth={1.7} /></span>
                    </div>
                    <Editable as="strong" id={`phase4-plan.bands.${item.id}.title`}>{item.title}</Editable>
                    <Editable as="span" id={`phase4-plan.bands.${item.id}.units`} className={styles.bandUnits}>{item.units}</Editable>
                    <Editable as="p" id={`phase4-plan.bands.${item.id}.text`} multiline>{item.text}</Editable>
                  </article>
                  {item.id !== 'release' && <ArrowRight className={styles.bandArrow} aria-hidden="true" strokeWidth={1.55} />}
                </div>
              )
            }}
          </EditableList>

          <div className={[styles.planPrinciple, slideStyles.planPrinciple].join(' ')}>
            <Editable as="strong" id="phase4-plan.principle.title">One shared package · no environment fork</Editable>
            <Editable as="span" id="phase4-plan.principle.text" multiline>
              AVM candidates are fit-reviewed and digest-bound; incompatibilities return to architecture rather than being hidden in code.
            </Editable>
          </div>
        </section>

        <div className={[styles.planBottom, slideStyles.planBottom].join(' ')}>
          <EditableList
            id="phase4-plan.metrics"
            items={planMetrics}
            keyOf={(item) => item.id}
            className={styles.planMetrics}
            itemClassName={styles.planMetricShell}
          >
            {(item) => (
              <article className={`${styles.surface} ${styles.planMetric}`}>
                <Editable as="strong" id={`phase4-plan.metrics.${item.id}.value`}>{item.value}</Editable>
                <Editable as="span" id={`phase4-plan.metrics.${item.id}.label`} multiline>{item.label}</Editable>
              </article>
            )}
          </EditableList>

          <EditableList
            id="phase4-plan.gates"
            items={releaseGates}
            keyOf={(item) => item.id}
            className={[styles.releaseGates, slideStyles.releaseGates].join(' ')}
            itemClassName={styles.releaseGateShell}
          >
            {(item) => {
              const Icon = item.icon
              return (
                <article className={[styles.surface, styles.releaseGate, slideStyles.releaseGate].join(' ')}>
                  <span aria-hidden="true"><Icon strokeWidth={1.7} /></span>
                  <div>
                    <Editable as="strong" id={`phase4-plan.gates.${item.id}.title`}>{item.title}</Editable>
                    <Editable as="p" id={`phase4-plan.gates.${item.id}.text`} multiline>{item.text}</Editable>
                  </div>
                </article>
              )
            }}
          </EditableList>
        </div>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="phase4-plan.footer">Stratton Europe Capital · Phase 4 implementation plan</Editable>} />
    </Slide>
  )
}
