import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import {
  Activity,
  Check,
  Clock3,
  DatabaseBackup,
  FileCheck2,
  LockKeyhole,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import styles from '../styles/PhaseSummarySlides.module.css'
import slideStyles from './RunTestsSlide.module.css'

const actualChecks = [
  {
    id: 'pester',
    value: '55/55',
    label: 'Pester IaC',
    detail: 'Pester IaC uses PowerShell tests to validate the infrastructure-as-code modules and deployment logic locally.',
  },
  {
    id: 'psrule',
    value: '47/47',
    label: 'PSRule',
    detail: 'PSRule applies static Azure rule checks to the generated infrastructure configuration against policy and best-practice rules.',
  },
  { id: 'unit', value: '47/47', label: 'App unit' },
  { id: 'integration', value: '30/30', label: 'App integration' },
]

const plannedAcceptanceGates = [
  {
    id: 'private',
    icon: LockKeyhole,
    title: 'Private path',
    method: 'Verify private WAF → private APIM → internal apps, private DNS, private endpoints and disabled public access after authorised deployment/preflight.',
    threshold: '0 public workload endpoints; 100% required DNS, group ID, VNet link and resolver evidence.',
    consequence: 'Any public route, DNS failure or unsupported private-ingress feature blocks release; no public fallback.',
  },
  {
    id: 'citations',
    icon: FileCheck2,
    title: 'Citation / provenance',
    method: 'Run approved benchmark and inspect material claims plus evidence envelopes for citation, owner, timestamp, licence and quality status.',
    threshold: '100% material-claim citation; 100% metadata completeness; 0 critical unsupported claims; ≤2% non-critical unsupported claims.',
    consequence: 'Missing citation, metadata or unsupported critical claim blocks Internal Audit verdict and release.',
  },
  {
    id: 'risk',
    icon: ShieldCheck,
    title: 'Extraction / risk',
    method: 'Run approved representative extraction, unsupported-claim and seeded-risk evaluations after severity definitions are approved.',
    threshold: '≥95% extraction accuracy; ≥99% critical financial/legal fields; ≥90% high-risk recall; 0 missed critical risks.',
    consequence: 'Any missed critical risk or failed critical-field threshold blocks release pending rework and retest.',
  },
  {
    id: 'authority',
    icon: UserRoundCheck,
    title: 'Human authority',
    method: 'Execute negative tests for approval bypass, automated decisions, source write-back, external disclosure and transaction execution; inspect audit trail.',
    threshold: '100% prevention; zero critical breach; zero system-issued investment decisions; 100% auditable required reviews.',
    consequence: 'Any bypass or system decision blocks release and becomes a control defect.',
  },
  {
    id: 'performance',
    icon: Clock3,
    title: 'Performance',
    method: 'In a production-like environment, run interactive and document-pack tests after business hours, pack profile and representative load are approved.',
    threshold: 'p95 interactive response <5s; typical document pack ≤30 min.',
    consequence: 'Breach blocks service acceptance until sizing, queues or workflow constraints are corrected.',
  },
  {
    id: 'recovery',
    icon: DatabaseBackup,
    title: 'Recovery',
    method: 'Execute approved recovery test with monitoring active and measure availability, RTO and RPO from correlated evidence.',
    threshold: '≥99.9% business-hours availability; RTO ≤4h; RPO ≤1h.',
    consequence: 'Breach blocks production acceptance; cost cannot justify weakening recovery, retention or security.',
  },
]

export default function RunTestsSlide({ index }) {
  return (
    <Slide index={index} className={`${styles.phaseSlide} ${styles.testingSlide} ${slideStyles.runTestsSlide}`}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      <div className={`${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />

        <header className={styles.header}>
          <Editable as="p" id="phase8-tests.eyebrow" className={styles.eyebrow}>
            Optional Phase · Exact approved deployment only
          </Editable>
          <Editable as="h2" id="phase8-tests.title" className={styles.title} multiline>
            Phase 8 - Run tests
          </Editable>
          <Editable as="p" id="phase8-tests.subtitle" className={styles.subtitle} multiline>
            Phase 8 Azure runtime tests are planned acceptance gates for isolation, evidence quality, human authority, performance and recovery.
          </Editable>
        </header>

        <div className={styles.testingGrid}>
          <aside className={`${styles.surface} ${styles.actualChecksPanel}`}>
            <div className={styles.actualHeading}>
              <TerminalResultIcon />
              <div>
                <Editable as="p" id="phase8-tests.actual.kicker" className={styles.panelKicker}>Actual Phase 5 evidence</Editable>
                <Editable as="h3" id="phase8-tests.actual.title">Local checks passed</Editable>
              </div>
            </div>

            <EditableList
              id="phase8-tests.actual"
              items={actualChecks}
              keyOf={(item) => item.id}
              className={styles.actualChecks}
              itemClassName={styles.actualCheckShell}
            >
              {(item) => (
                <article className={`${styles.actualCheck} ${slideStyles.interactiveActualCheck}`}>
                  <Check aria-hidden="true" strokeWidth={2} />
                  <div>
                    <Editable as="strong" id={`phase8-tests.actual.${item.id}.value`}>{item.value}</Editable>
                    <Editable as="span" id={`phase8-tests.actual.${item.id}.label`}>{item.label}</Editable>
                    {item.detail && (
                      <Editable as="p" id={`phase8-tests.actual.${item.id}.detail`} className={slideStyles.actualCheckDetail} multiline>
                        {item.detail}
                      </Editable>
                    )}
                  </div>
                </article>
              )}
            </EditableList>

          </aside>

          <section className={`${styles.surface} ${styles.plannedGatesPanel}`}>
            <div className={styles.panelLead}>
              <div>
                <Editable as="p" id="phase8-tests.planned.kicker" className={styles.panelKicker}>Planned Phase 8 acceptance gates</Editable>
                <Editable as="h3" id="phase8-tests.planned.title">Six release-defining gates</Editable>
              </div>
            </div>

            <EditableList
              id="phase8-tests.planned"
              items={plannedAcceptanceGates}
              keyOf={(item) => item.id}
              className={styles.plannedGateGrid}
              itemClassName={styles.plannedGateShell}
            >
              {(item) => {
                const Icon = item.icon
                return (
                  <article className={`${styles.plannedGateCard} ${slideStyles.interactivePlannedGate}`}>
                    <div className={styles.plannedGateTop}>
                      <span className={styles.plannedGateIcon} aria-hidden="true"><Icon strokeWidth={1.65} /></span>
                      <Editable as="h4" id={`phase8-tests.planned.${item.id}.title`}>{item.title}</Editable>
                    </div>
                    <ul className={slideStyles.gateBulletList}>
                      <li>
                        <Editable as="strong" id={`phase8-tests.planned.${item.id}.methodLabel`}>Method</Editable>
                        <Editable as="p" id={`phase8-tests.planned.${item.id}.method`} multiline>{item.method}</Editable>
                      </li>
                      <li>
                        <Editable as="strong" id={`phase8-tests.planned.${item.id}.thresholdLabel`}>Threshold</Editable>
                        <Editable as="p" id={`phase8-tests.planned.${item.id}.threshold`} multiline>{item.threshold}</Editable>
                      </li>
                      <li>
                        <Editable as="strong" id={`phase8-tests.planned.${item.id}.consequenceLabel`}>Release consequence</Editable>
                        <Editable as="p" id={`phase8-tests.planned.${item.id}.consequence`} multiline>{item.consequence}</Editable>
                      </li>
                    </ul>
                  </article>
                )
              }}
            </EditableList>

          </section>
        </div>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="phase8-tests.footer">Stratton Europe Capital · Optional Phase 8 planned acceptance gates · Azure runtime not run</Editable>} />
    </Slide>
  )
}

function TerminalResultIcon() {
  return (
    <span className={styles.actualHeadingIcon} aria-hidden="true">
      <Activity strokeWidth={1.7} />
    </span>
  )
}
