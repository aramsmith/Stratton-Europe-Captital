import { BottomBar, Editable, EditableList, Slide, useDisclosure } from '@deckio/deck-engine'
import {
  BadgeCheck,
  BrainCircuit,
  BriefcaseBusiness,
  FileCheck2,
  Landmark,
  PackageCheck,
  Scale,
  ShieldCheck,
  UserRound,
  UserRoundCheck,
} from 'lucide-react'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import azureAiFoundryLogo from '../data/azure-ai-foundry-logo.svg'
import microsoftCopilotLogo from '../data/microsoft-copilot-logo.svg'
import aiSearchLogo from '../data/azure-icons/ai-search.svg'
import azureOpenAiLogo from '../data/azure-icons/azure-openai.svg'
import documentIntelligenceLogo from '../data/azure-icons/document-intelligence.svg'
import styles from '../styles/PhaseSummarySlides.module.css'
import slideStyles from './HumanAiOperatingModelSlide.module.css'

const initiationSteps = [
  {
    id: 'case-opening',
    icon: BriefcaseBusiness,
    title: 'Authorised deal team',
    text: 'Opens the case',
  },
  {
    id: 'deal-eligibility',
    icon: FileCheck2,
    title: 'Deal Operations',
    text: 'Decides deal eligibility',
  },
  {
    id: 'jurisdiction-eligibility',
    icon: Scale,
    title: 'General Counsel',
    text: 'Decides jurisdiction eligibility',
  },
]

const policyControls = [
  { id: 'source-gates', label: 'Source · licence · purpose gates' },
  { id: 'quarantine', label: 'Quarantine + provenance capture' },
  { id: 'fail-closed', label: 'Missing evidence blocks progression' },
]

const aiCapabilities = [
  {
    id: 'retrieval',
    logo: aiSearchLogo,
    logoAlt: 'Azure AI Search',
    title: 'Retrieval AI',
    text: 'Retrieve governed evidence',
  },
  {
    id: 'document',
    logo: documentIntelligenceLogo,
    logoAlt: 'Azure AI Document Intelligence',
    title: 'Document AI',
    text: 'Extract and compare facts and fields',
  },
  {
    id: 'analysis',
    logo: azureOpenAiLogo,
    logoAlt: 'Azure OpenAI',
    title: 'Analytical AI',
    text: 'Analyse risk and ESG evidence; flag anomalies',
  },
  {
    id: 'grounding',
    logo: azureAiFoundryLogo,
    logoAlt: 'Azure AI Foundry',
    title: 'Grounding AI',
    text: 'Ground material claims and provide citations',
  },
]

const handoffItems = [
  { id: 'evidence', label: 'Governed evidence' },
  { id: 'facts', label: 'Extracted facts' },
  { id: 'comparisons', label: 'Comparisons' },
  { id: 'anomalies', label: 'Anomaly flags' },
  { id: 'drafts', label: 'Draft analyses' },
  { id: 'citations', label: 'Cited claims' },
]

const humanAuthorities = [
  {
    id: 'validation',
    copilotSupport: true,
    icon: UserRoundCheck,
    title: 'Deal professional validates',
    text: 'Source evidence and every material output',
  },
  {
    id: 'specialist-approval',
    copilotSupport: true,
    icon: Scale,
    title: 'Legal and Compliance approve',
    text: 'Applicable specialist conclusions',
  },
  {
    id: 'committee-decision',
    icon: Landmark,
    title: 'Investment Committee decides',
    text: 'Every investment decision',
  },
]

export default function HumanAiOperatingModelSlide({ index }) {
  const { isRevealed } = useDisclosure(5, { index })
  const revealClass = (step) => (isRevealed(step) ? slideStyles.isRevealed : slideStyles.isMuted)

  return (
    <Slide index={index} className={`${styles.phaseSlide} ${slideStyles.humanAiOperatingModelSlide}`}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      <div className={`${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />

        <header className={styles.header}>
          <Editable as="p" id="phase2-human-ai.eyebrow" className={styles.eyebrow}>
            Phase 2 · Human-AI operating model
          </Editable>
          <Editable as="h2" id="phase2-human-ai.title" className={styles.title} multiline>
            AI prepares evidence. People decide.
          </Editable>
          <Editable as="p" id="phase2-human-ai.subtitle" className={styles.subtitle} multiline>
            Governed AI capabilities accelerate analysis; accountable people validate, approve and retain every consequential decision.
          </Editable>
        </header>

        <div className={slideStyles.legend} aria-label="Execution-mode legend">
          <Editable as="span" id="phase2-human-ai.legend.human" className={slideStyles.humanLegend}>
            Human authority
          </Editable>
          <Editable as="span" id="phase2-human-ai.legend.ai" className={slideStyles.aiLegend}>
            AI assistance
          </Editable>
          <Editable as="span" id="phase2-human-ai.legend.control" className={slideStyles.controlLegend}>
            Policy controls are not AI
          </Editable>
        </div>

        <section className={slideStyles.relayStage} aria-label="Human and AI process relay">
          <section
            className={`${slideStyles.zone} ${slideStyles.initiationZone} ${revealClass(0)}`}
            data-operating-step="1"
          >
            <div className={slideStyles.zoneHeading}>
              <UserRound aria-hidden="true" className={slideStyles.zoneIcon} strokeWidth={1.7} />
              <Editable as="span" id="phase2-human-ai.initiation.label" className={slideStyles.zoneLabel}>
                1 · Human initiates
              </Editable>
            </div>
            <EditableList
              id="phase2-human-ai.initiation"
              items={initiationSteps}
              keyOf={(item) => item.id}
              className={slideStyles.initiationList}
              itemClassName={slideStyles.listShell}
            >
              {(item) => {
                const Icon = item.icon
                return (
                  <article className={slideStyles.initiationCard}>
                    <Icon aria-hidden="true" strokeWidth={1.7} />
                    <Editable as="strong" id={`phase2-human-ai.initiation.${item.id}.title`}>
                      {item.title}
                    </Editable>
                    <Editable as="p" id={`phase2-human-ai.initiation.${item.id}.text`} multiline>
                      {item.text}
                    </Editable>
                  </article>
                )
              }}
            </EditableList>
          </section>

          <section
            className={`${slideStyles.zone} ${slideStyles.controlZone} ${revealClass(1)}`}
            data-operating-step="2"
          >
            <div className={slideStyles.zoneHeading}>
              <ShieldCheck aria-hidden="true" className={slideStyles.zoneIcon} strokeWidth={1.7} />
              <Editable as="span" id="phase2-human-ai.controls.label" className={slideStyles.zoneLabel}>
                2 · Deterministic controls
              </Editable>
            </div>
            <EditableList
              id="phase2-human-ai.controls"
              items={policyControls}
              keyOf={(item) => item.id}
              className={slideStyles.controlList}
              itemClassName={slideStyles.listShell}
            >
              {(item) => (
                <Editable as="span" id={`phase2-human-ai.controls.${item.id}`}>
                  {item.label}
                </Editable>
              )}
            </EditableList>
          </section>

          <section
            className={`${slideStyles.zone} ${slideStyles.aiZone} ${revealClass(2)}`}
            data-operating-step="3"
          >
            <div className={slideStyles.zoneHeading}>
              <BrainCircuit aria-hidden="true" className={slideStyles.zoneIcon} strokeWidth={1.7} />
              <Editable as="span" id="phase2-human-ai.ai.label" className={slideStyles.zoneLabel}>
                3 · AI workbench
              </Editable>
            </div>
            <EditableList
              id="phase2-human-ai.ai-capabilities"
              items={aiCapabilities}
              keyOf={(item) => item.id}
              className={slideStyles.aiGrid}
              itemClassName={slideStyles.listShell}
            >
              {(item) => (
                <article className={slideStyles.aiCard}>
                  <img className={slideStyles.aiLogo} src={item.logo} alt={item.logoAlt} />
                  <div className={slideStyles.aiCopy}>
                    <Editable as="strong" id={`phase2-human-ai.ai-capabilities.${item.id}.title`}>
                      {item.title}
                    </Editable>
                    <Editable as="p" id={`phase2-human-ai.ai-capabilities.${item.id}.text`} multiline>
                      {item.text}
                    </Editable>
                  </div>
                </article>
              )}
            </EditableList>
          </section>

          <section
            className={`${slideStyles.zone} ${slideStyles.handoffZone} ${revealClass(3)}`}
            data-operating-step="4"
          >
            <div className={slideStyles.zoneHeading}>
              <PackageCheck aria-hidden="true" className={slideStyles.zoneIcon} strokeWidth={1.7} />
              <Editable as="span" id="phase2-human-ai.handoff.label" className={slideStyles.zoneLabel}>
                4 · Evidence-backed handoff
              </Editable>
            </div>
            <EditableList
              id="phase2-human-ai.handoff"
              items={handoffItems}
              keyOf={(item) => item.id}
              className={slideStyles.handoffGrid}
              itemClassName={slideStyles.listShell}
            >
              {(item) => (
                <Editable as="span" id={`phase2-human-ai.handoff.${item.id}`} className={slideStyles.handoffItem}>
                  {item.label}
                </Editable>
              )}
            </EditableList>
          </section>

          <section
            className={`${slideStyles.zone} ${slideStyles.authorityZone} ${revealClass(4)}`}
            data-operating-step="5"
          >
            <div className={slideStyles.zoneHeading}>
              <BadgeCheck aria-hidden="true" className={slideStyles.zoneIcon} strokeWidth={1.7} />
              <Editable as="span" id="phase2-human-ai.authority.label" className={slideStyles.zoneLabel}>
                5 · Human authority
              </Editable>
            </div>
            <EditableList
              id="phase2-human-ai.authority"
              items={humanAuthorities}
              keyOf={(item) => item.id}
              className={slideStyles.authorityList}
              itemClassName={slideStyles.listShell}
            >
              {(item) => {
                const Icon = item.icon
                return (
                  <article className={slideStyles.authorityCard}>
                    <span className={slideStyles.authorityIconStack}>
                      <Icon aria-hidden="true" strokeWidth={1.7} />
                      {item.copilotSupport && (
                        <img
                          className={slideStyles.copilotSupportLogo}
                          src={microsoftCopilotLogo}
                          alt="Microsoft Copilot supports this human role"
                        />
                      )}
                    </span>
                    <div>
                      <Editable as="strong" id={`phase2-human-ai.authority.${item.id}.title`}>
                        {item.title}
                      </Editable>
                      <Editable as="p" id={`phase2-human-ai.authority.${item.id}.text`} multiline>
                        {item.text}
                      </Editable>
                    </div>
                  </article>
                )
              }}
            </EditableList>
          </section>
        </section>

        <div className={`${slideStyles.boundaryStrip} ${revealClass(4)}`}>
          <ShieldCheck aria-hidden="true" strokeWidth={1.75} />
          <Editable as="p" id="phase2-human-ai.boundary" multiline>
            No autonomous decision · no approval · no transaction execution · no external disclosure · no source-system write-back
          </Editable>
        </div>

      </div>

      <PresentationStatus index={index} />
      <BottomBar
        text={<Editable as="span" id="phase2-human-ai.footer">Stratton Europe Capital · Phase 2 human-AI operating model</Editable>}
      />
    </Slide>
  )
}
