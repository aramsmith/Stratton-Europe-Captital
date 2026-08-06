import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import styles from './AgenticAssuranceRosterSlide.module.css'

const gateSteps = [
  { id: 'candidate', title: '1 · Phase Agent', text: 'Creates candidate' },
  { id: 'rubber-duck', title: '2 · Rubber Duck', text: 'Challenges logic' },
  { id: 'remediate-logic', title: '3 · Phase Agent', text: 'Remediates' },
  { id: 'security', title: '4 · Security', text: 'Assures compliance' },
  { id: 'remediate-controls', title: '5 · Phase Agent', text: 'Remediates' },
  { id: 'confirm-hashes', title: '6 · Both Reviewers', text: 'Confirm same hashes' },
  { id: 'human-approval', title: '7 · Human Architect', text: 'Approves in tool', human: true },
]

const standardAgents = [
  { id: 'aff-0', code: 'AFF-0', title: 'Coordinate', model: 'gpt-5.6-sol', role: 'Intake · interview · lifecycle state' },
  { id: 'aff-1', code: 'AFF-1', title: 'Requirements', model: 'gpt-5.6-sol', role: 'Human interview · governed baseline' },
  { id: 'aff-2', code: 'AFF-2', title: 'TOGAF Architecture', model: 'gpt-5.6-sol', role: 'Business · Data · App · Technology' },
  { id: 'aff-3', code: 'AFF-3', title: 'Azure Design', model: 'gpt-5.6-sol', role: 'Landing zones · CAF · WAF · controls' },
  { id: 'aff-4', code: 'AFF-4', title: 'Implementation Plan', model: 'gpt-5.6-sol', role: 'Dependencies · Bicep · rollback' },
  { id: 'aff-5', code: 'AFF-5', title: 'Coding', model: 'gpt-5.3-codex', role: 'Complete build · local validation' },
  { id: 'aff-6', code: 'AFF-6', title: 'C-level Presentation', model: 'gpt-5.6-sol', role: 'Approved evidence · board narrative' },
]

const optionalAgents = [
  {
    id: 'aff-7',
    code: 'AFF-7',
    title: 'Deployment',
    model: 'gpt-5.6-sol',
    role: 'Executes one explicitly scoped Azure deployment attempt and captures observed evidence.',
  },
  {
    id: 'aff-8',
    code: 'AFF-8',
    title: 'Runtime Testing',
    model: 'gpt-5.3-codex',
    role: 'Executes one authorised test plan against the exact approved deployment.',
  },
]

const reviewerAgents = [
  {
    id: 'aff-a',
    code: 'AFF-A',
    title: 'Rubber Duck Reviewer',
    model: 'gpt-5.4',
    role: 'Uses a different GPT model to challenge correctness, logic, traceability, and unsupported claims.',
  },
  {
    id: 'aff-b',
    code: 'AFF-B',
    title: 'Security & Compliance Reviewer',
    model: 'gpt-5.6-sol',
    role: 'Derives case-specific obligations and independently reviews privacy, sovereignty, and controls.',
  },
]

function AgentTile({ item, compact = false }) {
  return (
    <article className={`${styles.agentTile} ${compact ? styles.compactAgentTile : ''}`}>
      <div className={styles.agentMeta}>
        <Editable as="span" id={`agentic-roster.agents.${item.id}.code`} className={styles.agentCode}>{item.code}</Editable>
        <Editable as="span" id={`agentic-roster.agents.${item.id}.model`} className={styles.agentModel}>{item.model}</Editable>
      </div>
      <Editable as="h4" id={`agentic-roster.agents.${item.id}.title`}>{item.title}</Editable>
      <Editable as="p" id={`agentic-roster.agents.${item.id}.role`} multiline>{item.role}</Editable>
    </article>
  )
}

export default function AgenticAssuranceRosterSlide({ index }) {
  return (
    <Slide index={index} className={styles.agenticAssuranceRoster}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      <div className={`${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />

        <header className={styles.header}>
          <Editable as="h2" id="agentic-roster.title" className={styles.title}>
            Assurance by design. Human authority by default.
          </Editable>
          <Editable as="p" id="agentic-roster.subtitle" className={styles.subtitle} multiline>
            A specialist crew with sharp boundaries: independent challenge, shared evidence, and explicit human approval at every phase.
          </Editable>
        </header>

        <section className={styles.assurancePanel}>
          <div className={styles.sectionLead}>
            <Editable as="h3" id="agentic-roster.assurance.title">Phase assurance and approval sequence</Editable>
            <Editable as="p" id="agentic-roster.assurance.subtitle">Independent challenge. Shared evidence. Human authority.</Editable>
          </div>
          <EditableList
            id="agentic-roster.assurance.steps"
            items={gateSteps}
            keyOf={(item) => item.id}
            className={styles.gateSteps}
            itemClassName={styles.gateStepShell}
          >
            {(item) => (
              <article className={`${styles.gateStep} ${item.human ? styles.humanGate : ''}`}>
                <Editable as="strong" id={`agentic-roster.assurance.${item.id}.title`}>{item.title}</Editable>
                <Editable as="span" id={`agentic-roster.assurance.${item.id}.text`}>{item.text}</Editable>
              </article>
            )}
          </EditableList>
        </section>

        <section className={styles.rosterPanel}>
          <div className={styles.rosterHeader}>
            <Editable as="h3" id="agentic-roster.roster.title">Agent roster</Editable>
            <Editable as="p" id="agentic-roster.roster.subtitle">
              Standard delivery · human-invoked execution · independent assurance
            </Editable>
          </div>

          <div className={styles.standardLane}>
            <div className={styles.laneLabel}>
              <Editable as="strong" id="agentic-roster.standard.title">Standard route</Editable>
              <Editable as="span" id="agentic-roster.standard.range">AFF-0 → AFF-6</Editable>
            </div>
            <EditableList
              id="agentic-roster.standard.agents"
              items={standardAgents}
              keyOf={(item) => item.id}
              className={styles.standardAgents}
              itemClassName={styles.standardAgentShell}
            >
              {(item) => <AgentTile item={item} compact />}
            </EditableList>
          </div>

          <div className={styles.supportingLanes}>
            <section className={`${styles.supportingLane} ${styles.optionalLane}`}>
              <div className={styles.laneLabel}>
                <Editable as="strong" id="agentic-roster.optional.title">Optional route</Editable>
                <Editable as="span" id="agentic-roster.optional.rule">Human invocation only</Editable>
              </div>
              <EditableList
                id="agentic-roster.optional.agents"
                items={optionalAgents}
                keyOf={(item) => item.id}
                className={styles.supportingAgents}
                itemClassName={styles.supportingAgentShell}
              >
                {(item) => <AgentTile item={item} />}
              </EditableList>
            </section>

            <section className={`${styles.supportingLane} ${styles.reviewLane}`}>
              <div className={styles.laneLabel}>
                <Editable as="strong" id="agentic-roster.review.title">Independent assurance</Editable>
                <Editable as="span" id="agentic-roster.review.rule">Every phase · same hashes</Editable>
              </div>
              <EditableList
                id="agentic-roster.review.agents"
                items={reviewerAgents}
                keyOf={(item) => item.id}
                className={styles.supportingAgents}
                itemClassName={styles.supportingAgentShell}
              >
                {(item) => <AgentTile item={item} />}
              </EditableList>
            </section>
          </div>
        </section>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="agentic-roster.footer">Stratton Europe Capital · Assurance, approval and agent roster</Editable>} />
    </Slide>
  )
}
