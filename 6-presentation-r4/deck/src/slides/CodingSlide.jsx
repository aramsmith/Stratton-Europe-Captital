import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import {
  ArrowRight,
  Check,
  Code2,
  FileCode2,
  GitCommitHorizontal,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import containerAppsIcon from '../data/azure-icons/container-apps.svg'
import containerRegistryIcon from '../data/azure-icons/container-registry.svg'
import managementGroupsIcon from '../data/azure-icons/management-groups.svg'
import styles from '../styles/PhaseSummarySlides.module.css'
import slideStyles from './CodingSlide.module.css'

const repoInventory = [
  { id: 'app', path: 'app/', count: '41', text: 'TypeScript API + worker' },
  { id: 'infra', path: 'infra/', count: '39', text: 'Tenant-scope Bicep + DU entrypoints' },
  { id: 'tests', path: 'tests/', count: '23', text: 'IaC + application verification' },
  { id: 'validation', path: 'validation/', count: '8', text: 'Fail-fast evidence scripts' },
  { id: 'release', path: 'release/', count: '1', text: 'Bound release manifest' },
]

const releaseRoute = [
  { id: 'bicep', icon: managementGroupsIcon, title: 'Tenant-scope Bicep', text: '17 deployable units' },
  { id: 'registry', icon: containerRegistryIcon, title: 'Two OCI images', text: 'API + worker · digest-bound' },
  { id: 'apps', icon: containerAppsIcon, title: 'Azure target', text: 'Container Apps target' },
]

const localEvidence = [
  { id: 'pester', value: '55/55', label: 'Pester IaC tests' },
  { id: 'psrule', value: '47/47', label: 'PSRule checks' },
  { id: 'unit', value: '47/47', label: 'application unit tests' },
  { id: 'integration', value: '30/30', label: 'application integration tests' },
]

const validationSteps = [
  'Prerequisites',
  'IaC validation',
  'Module digests',
  'Package integrity',
  'Source security',
  'Database validation',
  'App dependencies',
  'App validation',
  'Containers',
  'Release evidence',
]

const skuRows = [
  {
    id: 'firewall',
    service: 'Firewall Premium',
    tier: 'AZFW_VNet + firewall policy Premium',
    status: 'Fixed/current evidence',
    note: 'Connectivity hub SKU is fixed in current IaC.',
  },
  {
    id: 'app-gateway',
    service: 'App Gateway WAF_v2',
    tier: 'Private frontend · min capacity 1 dev/tst, 2 prd',
    status: 'Fixed/current evidence',
    note: 'Max capacity remains owner input.',
  },
  {
    id: 'service-bus',
    service: 'Service Bus Premium · 1 MU',
    tier: 'Premium namespace · capacity 1',
    status: 'Fixed/current evidence',
    note: 'Current IaC overrides the Phase 3 nonprod Standard hypothesis.',
  },
  {
    id: 'apim',
    service: 'APIM PremiumV2 · capacity 1',
    tier: 'Internal API Management · PremiumV2',
    status: 'Fixed/current evidence',
    note: 'reconcile vs Phase 3 Standard v2 hypothesis',
  },
  {
    id: 'azure-openai',
    service: 'Azure OpenAI S0 · deployments Standard · model/quota owner input',
    tier: 'OpenAI account S0; deployment SKU Standard',
    status: 'Fixed/current evidence',
    note: 'Model key, name/version and quota remain owner input.',
  },
  {
    id: 'document-intelligence',
    service: 'Document Intelligence S0',
    tier: 'FormRecognizer · S0',
    status: 'Fixed/current evidence',
    note: 'Private/public-disabled pattern.',
  },
  {
    id: 'app-configuration',
    service: 'App Configuration Standard',
    tier: 'standard SKU · public access disabled',
    status: 'Fixed/current evidence',
    note: 'Current IaC parameter value is standard.',
  },
  {
    id: 'owner-sizing',
    service: 'SQL / Search / Storage / Container Apps sizing: owner decisions',
    tier: 'SKU, replicas, redundancy and workload profile open',
    status: 'Owner decision / reconciliation',
    note: 'Do not treat these as fixed current-IaC pricing inputs.',
  },
]

export default function CodingSlide({ index }) {
  return (
    <Slide index={index} className={`${styles.phaseSlide} ${styles.codingSlide} ${slideStyles.codingSlide}`}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      <div className={`${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />

        <header className={styles.header}>
          <Editable as="p" id="phase5-coding.eyebrow" className={styles.eyebrow}>
            Phase 5 · Complete package, local evidence only
          </Editable>
          <Editable as="h2" id="phase5-coding.title" className={styles.title} multiline>
            Phase 5 - Coding
          </Editable>
          <Editable as="p" id="phase5-coding.subtitle" className={styles.subtitle} multiline>
            Hash-bound Bicep, TypeScript services and digest-bound containers are packaged with reproducible local assurance.
          </Editable>
        </header>

        <EditableList
          id="phase5-coding.build-flow"
          items={releaseRoute}
          keyOf={(item) => item.id}
          className={`${styles.surface} ${styles.releaseRouteHero}`}
          itemClassName={styles.releaseRouteShell}
        >
          {(item) => (
            <div className={styles.releaseRouteWrap}>
              <article className={styles.releaseRouteNode}>
                <img src={item.icon} alt="" aria-hidden="true" />
                <div>
                  <Editable as="strong" id={`phase5-coding.build-flow.${item.id}.title`}>{item.title}</Editable>
                  <Editable as="span" id={`phase5-coding.build-flow.${item.id}.text`}>{item.text}</Editable>
                </div>
              </article>
              {item.id !== 'apps' && <ArrowRight className={styles.releaseRouteArrow} aria-hidden="true" strokeWidth={1.55} />}
            </div>
          )}
        </EditableList>

        <div className={styles.codingGrid}>
          <section className={`${styles.surface} ${styles.repoPanel}`}>
            <div className={styles.panelLead}>
              <div>
                <Editable as="p" id="phase5-coding.repo.kicker" className={styles.panelKicker}>Release manifest inventory</Editable>
                <Editable as="h3" id="phase5-coding.repo.title">116 deployable source files</Editable>
              </div>
              <Code2 aria-hidden="true" strokeWidth={1.65} />
            </div>

            <EditableList
              id="phase5-coding.repo"
              items={repoInventory}
              keyOf={(item) => item.id}
              className={styles.repoTree}
              itemClassName={styles.repoTreeShell}
            >
              {(item) => (
                <div className={styles.repoRow}>
                  <FileCode2 aria-hidden="true" strokeWidth={1.6} />
                  <Editable as="strong" id={`phase5-coding.repo.${item.id}.path`}>{item.path}</Editable>
                  <Editable as="span" id={`phase5-coding.repo.${item.id}.text`}>{item.text}</Editable>
                  <Editable as="small" id={`phase5-coding.repo.${item.id}.count`}>{item.count}</Editable>
                </div>
              )}
            </EditableList>
          </section>

          <div className={styles.codingEvidence}>
            <section className={`${styles.surface} ${styles.localEvidencePanel}`}>
              <div className={styles.evidenceHeading}>
                <TerminalSquare aria-hidden="true" strokeWidth={1.65} />
                <div>
                  <Editable as="p" id="phase5-coding.evidence.kicker" className={styles.panelKicker}>Retained local run · PASS</Editable>
                  <Editable as="h3" id="phase5-coding.evidence.title">10/10 validation steps</Editable>
                </div>
              </div>

              <EditableList
                id="phase5-coding.evidence.metrics"
                items={localEvidence}
                keyOf={(item) => item.id}
                className={styles.localMetricGrid}
                itemClassName={styles.localMetricShell}
              >
                {(item) => (
                  <article className={styles.localMetric}>
                    <Editable as="strong" id={`phase5-coding.evidence.metrics.${item.id}.value`}>{item.value}</Editable>
                    <Editable as="span" id={`phase5-coding.evidence.metrics.${item.id}.label`} multiline>{item.label}</Editable>
                  </article>
                )}
              </EditableList>

              <EditableList
                id="phase5-coding.evidence.steps"
                items={validationSteps.map((label, stepIndex) => ({ id: `step-${stepIndex + 1}`, label }))}
                keyOf={(item) => item.id}
                className={styles.validationChips}
                itemClassName={styles.validationChipShell}
              >
                {(item) => (
                  <span className={styles.validationChip}>
                    <Check aria-hidden="true" strokeWidth={2} />
                    <Editable as="span" id={`phase5-coding.evidence.steps.${item.id}`}>{item.label}</Editable>
                  </span>
                )}
              </EditableList>
            </section>

            <section className={`${styles.surface} ${styles.supplyChainPanel}`}>
              <div className={styles.supplyIcon}><ShieldCheck aria-hidden="true" strokeWidth={1.7} /></div>
              <div>
                <Editable as="strong" id="phase5-coding.supply.title">Supply-chain evidence</Editable>
                <Editable as="p" id="phase5-coding.supply.text" multiline>
                  API and worker images include CycloneDX SBOMs, digest statements and scans reporting 0 HIGH, 0 CRITICAL and 0 secrets.
                </Editable>
              </div>
              <span className={styles.integrityTag}>
                <GitCommitHorizontal aria-hidden="true" strokeWidth={1.7} />
                <Editable as="span" id="phase5-coding.supply.tag">hash-bound</Editable>
              </span>
            </section>
          </div>

          <section className={`${styles.surface} ${styles.skuPanel}`}>
            <div className={styles.skuHeader}>
              <div>
                <Editable as="p" id="phase5-coding.skus.kicker" className={styles.panelKicker}>Fixed/current evidence</Editable>
                <Editable as="h3" id="phase5-coding.skus.title">Important Azure SKUs / tiers</Editable>
              </div>
              <Editable as="span" id="phase5-coding.skus.group" className={styles.skuStatus}>Owner decision / reconciliation</Editable>
            </div>

            <EditableList
              id="phase5-coding.skus"
              items={skuRows}
              keyOf={(item) => item.id}
              className={styles.skuRows}
              itemClassName={styles.skuRowShell}
            >
              {(item) => (
                <article className={styles.skuRow}>
                  <div className={styles.skuRowTop}>
                    <Editable as="strong" id={`phase5-coding.skus.${item.id}.service`} multiline>{item.service}</Editable>
                    <Editable as="span" id={`phase5-coding.skus.${item.id}.status`} className={styles.skuStatus}>{item.status}</Editable>
                  </div>
                  <Editable as="span" id={`phase5-coding.skus.${item.id}.tier`} className={styles.skuTier} multiline>{item.tier}</Editable>
                  <Editable as="span" id={`phase5-coding.skus.${item.id}.note`} className={styles.skuNote} multiline>{item.note}</Editable>
                </article>
              )}
            </EditableList>
          </section>
        </div>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="phase5-coding.footer">Stratton Europe Capital · Phase 5 coding and local evidence</Editable>} />
    </Slide>
  )
}
