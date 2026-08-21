import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import { ArrowRight, BadgeAlert, GlobeLock, ShieldCheck } from 'lucide-react'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import aiSearchIcon from '../data/azure-icons/ai-search.svg'
import apiManagementIcon from '../data/azure-icons/api-management.svg'
import applicationGatewayIcon from '../data/azure-icons/application-gateway.svg'
import applicationInsightsIcon from '../data/azure-icons/application-insights.svg'
import azureAiFoundryLogo from '../data/azure-ai-foundry-logo.svg'
import azureOpenAiIcon from '../data/azure-icons/azure-openai.svg'
import containerAppsIcon from '../data/azure-icons/container-apps.svg'
import containerRegistryIcon from '../data/azure-icons/container-registry.svg'
import defenderCloudIcon from '../data/azure-icons/defender-cloud.svg'
import deploymentIcon from '../data/azure-icons/deployment-environments.svg'
import documentIntelligenceIcon from '../data/azure-icons/document-intelligence.svg'
import firewallIcon from '../data/azure-icons/firewall.svg'
import keyVaultIcon from '../data/azure-icons/key-vault.svg'
import logAnalyticsIcon from '../data/azure-icons/log-analytics.svg'
import managementGroupsIcon from '../data/azure-icons/management-groups.svg'
import monitorIcon from '../data/azure-icons/monitor.svg'
import policyIcon from '../data/azure-icons/policy.svg'
import privateEndpointIcon from '../data/azure-icons/private-endpoint.svg'
import serviceBusIcon from '../data/azure-icons/service-bus.svg'
import sqlDatabaseIcon from '../data/azure-icons/sql-database.svg'
import storageIcon from '../data/azure-icons/storage.svg'
import virtualNetworkIcon from '../data/azure-icons/virtual-network.svg'
import styles from '../styles/PhaseSummarySlides.module.css'
import slideStyles from './AzureDesignSlide.module.css'

const runtimePath = [
  { id: 'enterprise', icon: privateEndpointIcon, label: 'Private enterprise access' },
  { id: 'gateway', icon: applicationGatewayIcon, label: 'Application Gateway' },
  { id: 'apim', icon: apiManagementIcon, label: 'APIM AI Gateway' },
  { id: 'apps', icon: containerAppsIcon, label: 'Container Apps agents' },
]

const citadelCore = [
  {
    id: 'governance',
    icons: [azureAiFoundryLogo],
    title: 'Foundry / Citadel governance',
    text: 'model approvals · evaluations · AI-use policy',
  },
  {
    id: 'gateway',
    icons: [apiManagementIcon],
    title: 'AI Gateway — API Management',
    text: 'private policy boundary · auth · throttling',
  },
  {
    id: 'agents',
    icons: [containerAppsIcon],
    title: 'Container Apps agents + APIs',
    text: 'interactive services · workers · jobs',
  },
  {
    id: 'regional-ai',
    icons: [azureOpenAiIcon, documentIntelligenceIcon],
    title: 'Azure OpenAI + Document Intelligence',
    text: 'EU Data Zone · private endpoints · no training use',
  },
]

const guardrailDomains = [
  {
    id: 'identity',
    icons: [keyVaultIcon],
    label: 'Identity / RBAC / PIM',
    text: 'Entra · managed identities · no standing Owner',
  },
  {
    id: 'connectivity',
    icons: [virtualNetworkIcon, firewallIcon, privateEndpointIcon],
    label: 'Connectivity / private networking',
    text: 'hub-spoke · Firewall · Private DNS · Private Link',
  },
  {
    id: 'security',
    icons: [defenderCloudIcon],
    label: 'Security controls',
    text: 'Defender · deny public access · egress allow-list',
  },
  {
    id: 'policy',
    icons: [policyIcon, managementGroupsIcon],
    label: 'Policy / governance',
    text: 'ALZ inheritance · sovereign overlay · fail-closed',
  },
  {
    id: 'data',
    icons: [sqlDatabaseIcon, storageIcon, aiSearchIcon, keyVaultIcon],
    label: 'Data / knowledge / secrets',
    text: 'SQL · Storage · AI Search · Key Vault',
  },
  {
    id: 'devsecops',
    icons: [deploymentIcon, containerRegistryIcon],
    label: 'DevSecOps / platform engineering',
    text: 'Bicep · pinned AVM candidates · gates',
  },
  {
    id: 'observability',
    icons: [monitorIcon, logAnalyticsIcon, applicationInsightsIcon],
    label: 'Operations / observability',
    text: 'Monitor · logs · alerts · runbooks',
  },
  {
    id: 'resilience',
    icons: [serviceBusIcon],
    label: 'Resilience / DR + FinOps',
    text: 'zonal primary · warm recovery · material fixed costs',
  },
]

const dependencyServices = [
  { id: 'sql', label: 'SQL' },
  { id: 'storage', label: 'Storage' },
  { id: 'search', label: 'AI Search' },
  { id: 'openai', label: 'Azure OpenAI' },
  { id: 'documents', label: 'Document Intelligence' },
  { id: 'vault', label: 'Key Vault' },
  { id: 'bus', label: 'Service Bus' },
]

const subscriptionBoundaries = [
  {
    id: 'platform',
    tone: 'platform',
    icon: managementGroupsIcon,
    label: 'Platform',
    text: 'management · connectivity · AI governance',
  },
  {
    id: 'nonprod',
    tone: 'nonProd',
    icon: virtualNetworkIcon,
    label: 'Non-production',
    text: 'development + test · synthetic data only',
  },
  {
    id: 'production',
    tone: 'production',
    icon: containerAppsIcon,
    label: 'Production + warm recovery',
    text: 'primary private spoke · recovery private spoke',
  },
  {
    id: 'assurance',
    tone: 'assurance',
    icon: monitorIcon,
    label: 'Independent assurance',
    text: 'Internal Audit immutable evidence + verdict',
  },
]

const designTargets = [
  { id: 'availability', value: '99.9%', label: 'approved business-hours availability target' },
  { id: 'rto', value: '≤4h', label: 'RTO design target' },
  { id: 'rpo', value: '≤1h', label: 'RPO design target' },
  { id: 'latency', value: '<5s', label: 'interactive p95 target' },
  { id: 'pack', value: '≤30m', label: 'document-pack target' },
]

const boundaryFacts = [
  { id: 'ingress', text: 'Private ingress only' },
  { id: 'public-access', text: 'Public DB/data/AI access disabled where supported' },
  { id: 'regional-ai', text: 'EU Data Zone Standard only; Global Standard prohibited' },
  { id: 'synthetic', text: 'Non-prod uses synthetic data' },
]

const considerations = [
  { id: 'supplement', text: 'Citadel supplements ALZ; it does not replace it' },
  { id: 'guidance', text: 'Foundry Citadel is adapted guidance, not a standalone product' },
  { id: 'runtime', text: 'Workload AI remains in Stratton workload subscriptions' },
]

export default function AzureDesignSlide({ index }) {
  return (
    <Slide index={index} className={`${styles.phaseSlide} ${styles.azureSlide} ${slideStyles.azureDesignSlide}`}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      <div className={`${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />

        <header className={styles.header}>
          <Editable as="p" id="phase3-azure.eyebrow" className={styles.eyebrow}>
            Phase 3 · Citadel landing-zone design
          </Editable>
          <Editable as="h2" id="phase3-azure.title" className={styles.title} multiline>
            Phase 3 — The Azure Design
          </Editable>
          <Editable as="p" id="phase3-azure.subtitle" className={styles.subtitle} multiline>
            A private EU Data Zone Citadel AI core operates inside Azure Landing Zone guardrails, with explicit Stratton subscription separation, warm recovery and independent assurance.
          </Editable>
        </header>

        <div className={styles.azureGrid}>
          <section className={`${styles.surface} ${styles.azureCanvas}`} aria-label="AI core inside governed landing-zone guardrails">
            <div className={styles.azureDiagramLead}>
              <div>
                <Editable as="p" id="phase3-azure.diagram.kicker" className={styles.panelKicker}>
                  Citadel · Azure Landing Zones + sovereign controls
                </Editable>
                <Editable as="h3" id="phase3-azure.diagram.title" multiline>
                  AI core inside governed landing-zone guardrails
                </Editable>
              </div>
              <span className={styles.regionBadge}>
                <GlobeLock aria-hidden="true" strokeWidth={1.7} />
                <Editable as="span" id="phase3-azure.diagram.region">EU Data Zone Standard</Editable>
              </span>
            </div>

            <div className={styles.alzGuardrailFrame}>
              <div className={styles.alzFrameLabel}>
                <img src={managementGroupsIcon} alt="" aria-hidden="true" />
                <Editable as="span" id="phase3-azure.alz-frame.label">
                  Azure Landing Zone foundation + Citadel AI governance overlay
                </Editable>
              </div>

              <div className={styles.guardrailDomainGrid}>
                <EditableList
                  id="phase3-azure.guardrails"
                  items={guardrailDomains}
                  keyOf={(item) => item.id}
                  className={styles.guardrailDomainList}
                  itemClassName={styles.guardrailDomainShell}
                >
                  {(item) => (
                    <article
                      className={`${styles.guardrailDomainCard} ${slideStyles.interactiveArchitectureBlock}`}
                      data-architecture-block={`guardrail-${item.id}`}
                    >
                      <div className={styles.guardrailIconRow} aria-hidden="true">
                        {item.icons.map((icon, iconIndex) => (
                          <img key={`${item.id}-${iconIndex}`} src={icon} alt="" />
                        ))}
                      </div>
                      <Editable as="strong" id={`phase3-azure.guardrails.${item.id}.label`} multiline>
                        {item.label}
                      </Editable>
                      <Editable as="span" id={`phase3-azure.guardrails.${item.id}.text`} multiline>
                        {item.text}
                      </Editable>
                    </article>
                  )}
                </EditableList>

                <EditableList
                  id="phase3-azure.runtime-path"
                  items={runtimePath}
                  keyOf={(item) => item.id}
                  className={`${styles.runtimePathRibbon} ${slideStyles.interactiveArchitectureBlock}`}
                  itemClassName={styles.runtimePathShell}
                  data-architecture-block="runtime-path"
                >
                  {(item) => (
                    <div className={styles.runtimePathNode}>
                      <img src={item.icon} alt="" aria-hidden="true" />
                      <Editable as="span" id={`phase3-azure.runtime-path.${item.id}`} multiline>
                        {item.label}
                      </Editable>
                      {item.id !== 'apps' && <ArrowRight aria-hidden="true" strokeWidth={1.65} />}
                    </div>
                  )}
                </EditableList>

                <div className={styles.citadelCore}>
                  <Editable as="span" id="phase3-azure.core.label" className={styles.coreLabel}>
                    Citadel AI core
                  </Editable>
                  <EditableList
                    id="phase3-azure.core"
                    items={citadelCore}
                    keyOf={(item) => item.id}
                    className={styles.citadelCoreStack}
                    itemClassName={styles.citadelCoreShell}
                  >
                    {(item) => (
                      <article
                        className={`${styles.citadelCoreCard} ${slideStyles.interactiveArchitectureBlock}`}
                        data-architecture-block={`core-${item.id}`}
                      >
                        <span className={styles.citadelCoreIcons} aria-hidden="true">
                          {item.icons.map((icon, iconIndex) => (
                            <img key={`${item.id}-${iconIndex}`} src={icon} alt="" />
                          ))}
                        </span>
                        <div>
                          <Editable as="strong" id={`phase3-azure.core.${item.id}.title`} multiline>
                            {item.title}
                          </Editable>
                          <Editable as="span" id={`phase3-azure.core.${item.id}.text`} multiline>
                            {item.text}
                          </Editable>
                        </div>
                      </article>
                    )}
                  </EditableList>
                </div>

                <div
                  className={`${styles.dependencyFanout} ${slideStyles.interactiveArchitectureBlock}`}
                  data-architecture-block="dependency-fanout"
                >
                  <Editable as="strong" id="phase3-azure.dependencies.label">Private dependency fan-out</Editable>
                  <EditableList
                    id="phase3-azure.dependencies"
                    items={dependencyServices}
                    keyOf={(item) => item.id}
                    className={styles.dependencyChipList}
                    itemClassName={styles.dependencyChipShell}
                  >
                    {(item) => (
                      <Editable as="span" id={`phase3-azure.dependencies.${item.id}`}>
                        {item.label}
                      </Editable>
                    )}
                  </EditableList>
                </div>
              </div>

              <div className={styles.subscriptionStrip}>
                <EditableList
                  id="phase3-azure.subscriptions"
                  items={subscriptionBoundaries}
                  keyOf={(item) => item.id}
                  className={styles.subscriptionBoundaryList}
                  itemClassName={styles.subscriptionBoundaryShell}
                >
                  {(item) => (
                    <article
                      className={`${styles.subscriptionBoundaryCard} ${styles[`${item.tone}Boundary`]} ${slideStyles.interactiveArchitectureBlock}`}
                      data-architecture-block={`subscription-${item.id}`}
                    >
                      <div className={styles.subscriptionBoundaryHeading}>
                        <img src={item.icon} alt="" aria-hidden="true" />
                        <Editable as="strong" id={`phase3-azure.subscriptions.${item.id}.label`} multiline>
                          {item.label}
                        </Editable>
                      </div>
                      <Editable as="span" id={`phase3-azure.subscriptions.${item.id}.text`} multiline>
                        {item.text}
                      </Editable>
                      {item.id === 'assurance' && (
                        <div className={styles.assuranceSubmission}>
                          <Editable as="span" id="phase3-azure.assurance.submission">
                            signed evidence submission
                          </Editable>
                          <ArrowRight aria-hidden="true" strokeWidth={1.7} />
                        </div>
                      )}
                    </article>
                  )}
                </EditableList>
              </div>
            </div>
          </section>

          <aside className={styles.azureSide} aria-label="Azure design objectives and considerations">
            <section className={`${styles.surface} ${styles.targetPanel}`}>
              <Editable as="span" id="phase3-azure.targets.label" className={styles.cardLabel}>
                Design objectives
              </Editable>
              <EditableList
                id="phase3-azure.targets"
                items={designTargets}
                keyOf={(item) => item.id}
                className={styles.targetList}
                itemClassName={styles.targetShell}
              >
                {(item) => (
                  <article
                    className={`${styles.targetCard} ${slideStyles.interactiveArchitectureBlock}`}
                    data-architecture-block={`target-${item.id}`}
                  >
                    <Editable as="strong" id={`phase3-azure.targets.${item.id}.value`}>{item.value}</Editable>
                    <Editable as="span" id={`phase3-azure.targets.${item.id}.label`} multiline>{item.label}</Editable>
                  </article>
                )}
              </EditableList>
            </section>

            <section
              className={`${styles.surface} ${styles.boundaryFactPanel} ${slideStyles.interactiveArchitectureBlock}`}
              data-architecture-block="boundary-facts"
            >
              <div className={styles.azureRailHeading}>
                <ShieldCheck aria-hidden="true" strokeWidth={1.7} />
                <Editable as="strong" id="phase3-azure.boundary-facts.title">Boundary facts</Editable>
              </div>
              <EditableList
                id="phase3-azure.boundary-facts"
                items={boundaryFacts}
                keyOf={(item) => item.id}
                className={styles.azureBulletList}
                itemClassName={styles.azureBulletShell}
              >
                {(item) => (
                  <Editable as="span" id={`phase3-azure.boundary-facts.${item.id}`} multiline>
                    {item.text}
                  </Editable>
                )}
              </EditableList>
            </section>

            <section
              className={`${styles.surface} ${styles.considerationsPanel} ${slideStyles.interactiveArchitectureBlock}`}
              data-architecture-block="considerations"
            >
              <div className={styles.azureRailHeading}>
                <BadgeAlert aria-hidden="true" strokeWidth={1.7} />
                <Editable as="strong" id="phase3-azure.considerations.title" role="heading" aria-level={3}>Considerations</Editable>
              </div>
              <EditableList
                id="phase3-azure.considerations"
                items={considerations}
                keyOf={(item) => item.id}
                className={styles.azureBulletList}
                itemClassName={styles.azureBulletShell}
              >
                {(item) => (
                  <Editable as="span" id={`phase3-azure.considerations.${item.id}`} multiline>
                    {item.text}
                  </Editable>
                )}
              </EditableList>
            </section>
          </aside>
        </div>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="phase3-azure.footer">Stratton Europe Capital · Phase 3 Azure design</Editable>} />
    </Slide>
  )
}
