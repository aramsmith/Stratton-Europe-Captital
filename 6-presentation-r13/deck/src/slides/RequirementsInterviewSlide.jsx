import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import {
  ArrowRight,
  ClipboardCheck,
  Clock,
  LockKeyhole,
  MessageSquare,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import styles from './RequirementsInterviewSlide.module.css'

const interviewDomains = [
  { id: 'business', label: 'Business', score: '96%', percentage: 96 },
  { id: 'data', label: 'Data', score: '94%', percentage: 94 },
  { id: 'application', label: 'Application', score: '97%', percentage: 97 },
  { id: 'technology', label: 'Technology', score: '95%', percentage: 95 },
  { id: 'security', label: 'Security', score: '96%', percentage: 96 },
]

const authorityFlow = [
  { id: 'assist', label: 'AI assists', tone: 'assist' },
  { id: 'validate', label: 'Deal professional validates', tone: 'human' },
  { id: 'approve', label: 'Legal & Compliance approves', tone: 'human' },
  { id: 'decide', label: 'Investment Committee decides', tone: 'decision' },
]

const phaseHighlights = [
  {
    id: 'authority',
    icon: UserCheck,
    title: 'Human authority retained',
    value: 'AI assists. People decide.',
    description: 'Authority is shown in the four-step human control flow below.',
  },
  {
    id: 'boundary',
    icon: ShieldCheck,
    title: 'Controlled Release 1',
    value: '20 eligible deals',
    description: 'Governed evidence only—no autonomous decisions, transactions, external communications, source-system write-back, or unrestricted rollout.',
  },
  {
    id: 'baseline',
    icon: ClipboardCheck,
    title: 'Testable baseline',
    value: '31 requirements · 31 tests',
    description: 'EU/EEA sovereignty and GDPR are mandatory; other regulatory obligations remain evidence-bound with no unsupported compliance claim.',
  },
]

export default function RequirementsInterviewSlide({ index }) {
  return (
    <Slide index={index} className={styles.requirementsInterview}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      <div className={`${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />

        <header className={styles.header}>
          <Editable as="p" id="phase1-requirements.eyebrow" className={styles.eyebrow}>
            Phase 1 · From dialogue to a testable contract
          </Editable>
          <Editable as="h2" id="phase1-requirements.title" className={styles.title} multiline>
            Phase 1 - Requirements and customer interview
          </Editable>
          <Editable as="p" id="phase1-requirements.subtitle" className={styles.subtitle} multiline>
            The architect-led interview converted Stratton&apos;s ambition, human-control model and regulatory boundaries into a measurable Release 1 baseline.
          </Editable>
        </header>

        <div className={styles.mainGrid}>
          <section className={styles.interviewPanel}>
            <div className={styles.panelHeading}>
              <span className={styles.panelIcon} aria-hidden="true">
                <MessageSquare strokeWidth={1.8} />
              </span>
              <div>
                <Editable as="h3" id="phase1-requirements.interview.title">Customer interview close</Editable>
                <Editable as="p" id="phase1-requirements.interview.subtitle">Five domains · no material decision unanswered</Editable>
              </div>
            </div>

            <div className={styles.confidenceDial} aria-hidden="true">
              <div className={styles.confidenceCore}>
                <Editable as="strong" id="phase1-requirements.interview.confidence">96%</Editable>
                <Editable as="span" id="phase1-requirements.interview.confidence-label">shared understanding</Editable>
              </div>
            </div>

            <EditableList
              id="phase1-requirements.interview.domains"
              items={interviewDomains}
              keyOf={(item) => item.id}
              className={styles.domainList}
              itemClassName={styles.domainShell}
            >
              {(item) => (
                <div className={styles.domainRow} style={{ '--domain-score': `${item.percentage}%` }}>
                  <div className={styles.domainMeta}>
                    <Editable as="span" id={`phase1-requirements.interview.domains.${item.id}.label`}>{item.label}</Editable>
                    <Editable as="strong" id={`phase1-requirements.interview.domains.${item.id}.score`}>{item.score}</Editable>
                  </div>
                  <span className={styles.domainTrack} aria-hidden="true">
                    <span className={styles.domainFill} />
                  </span>
                </div>
              )}
            </EditableList>

          </section>

          <div className={styles.outcomeColumn}>
            <section className={styles.outcomeBanner}>
              <div className={styles.outcomeIcon} aria-hidden="true">
                <Clock strokeWidth={1.55} />
              </div>
              <div className={styles.outcomeCopy}>
                <Editable as="p" id="phase1-requirements.outcome.label" className={styles.outcomeLabel}>
                  Accountable business outcome
                </Editable>
                <div className={styles.outcomeChange}>
                  <Editable as="strong" id="phase1-requirements.outcome.from">12 weeks</Editable>
                  <ArrowRight aria-hidden="true" strokeWidth={1.65} />
                  <Editable as="strong" id="phase1-requirements.outcome.to">≤3 weeks</Editable>
                </div>
                <Editable as="p" id="phase1-requirements.outcome.scope" className={styles.outcomeScope} multiline>
                  Within 12 months · first 20 eligible new private-equity opportunities · CIO accountable
                </Editable>
              </div>
              <div className={styles.journey}>
                <Editable as="span" id="phase1-requirements.outcome.journey-start">Formal case opening</Editable>
                <span className={styles.journeyLine} aria-hidden="true" />
                <Editable as="span" id="phase1-requirements.outcome.journey-end">IC-ready draft recommendation</Editable>
              </div>
            </section>

            <EditableList
              id="phase1-requirements.highlights"
              items={phaseHighlights}
              keyOf={(item) => item.id}
              className={styles.highlightGrid}
              itemClassName={styles.highlightShell}
            >
              {(item) => {
                const Icon = item.icon
                return (
                  <article className={styles.highlightCard}>
                    <span className={styles.highlightIcon} aria-hidden="true">
                      <Icon strokeWidth={1.75} />
                    </span>
                    <Editable as="h3" id={`phase1-requirements.highlights.${item.id}.title`}>{item.title}</Editable>
                    <Editable as="strong" id={`phase1-requirements.highlights.${item.id}.value`}>{item.value}</Editable>
                    {item.id === 'authority' ? (
                      <EditableList
                        id="phase1-requirements.highlights.authority.flow"
                        items={authorityFlow}
                        keyOf={(step) => step.id}
                        className={styles.authorityFlow}
                        itemClassName={styles.authorityFlowShell}
                      >
                        {(step, stepIndex) => (
                          <div className={styles.authorityFlowWrap}>
                            <article
                              className={`${styles.authorityFlowStep} ${step.tone === 'assist'
                                ? styles.authorityAssistStep
                                : step.tone === 'decision'
                                  ? styles.authorityDecisionStep
                                  : styles.authorityHumanStep}`}
                            >
                              <Editable as="span" id={`phase1-requirements.highlights.authority.flow.${step.id}.label`} multiline>{step.label}</Editable>
                            </article>
                            {stepIndex < authorityFlow.length - 1 && (
                              <span className={styles.authorityFlowConnector} aria-hidden="true">
                                <ArrowRight strokeWidth={1.55} />
                              </span>
                            )}
                          </div>
                        )}
                      </EditableList>
                    ) : (
                      <Editable as="p" id={`phase1-requirements.highlights.${item.id}.description`} multiline>{item.description}</Editable>
                    )}
                  </article>
                )
              }}
            </EditableList>

            <section className={styles.approvalGate}>
              <span className={styles.gateIcon} aria-hidden="true">
                <LockKeyhole strokeWidth={1.8} />
              </span>
              <div>
                <Editable as="strong" id="phase1-requirements.gate.title">Phase boundary</Editable>
                <Editable as="p" id="phase1-requirements.gate.description" multiline>
                  Rubber Duck and Security &amp; Compliance assurance over the same unchanged evidence, followed by explicit human approval.
                </Editable>
              </div>
            </section>
          </div>
        </div>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="phase1-requirements.footer">Stratton Europe Capital · Phase 1 requirements and customer interview</Editable>} />
    </Slide>
  )
}
