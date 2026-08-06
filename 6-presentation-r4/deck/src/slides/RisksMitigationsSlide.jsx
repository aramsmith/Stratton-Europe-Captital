import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import {
  BadgeCheck,
  ClipboardCheck,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import styles from './RisksMitigationsSlide.module.css'

const assumptions = [
  { id: 'data', title: 'Representative data', text: 'Stratton can supply an approved subset of portfolio and reporting data for a non-production POC.' },
  { id: 'owners', title: 'Owner participation', text: 'Data owners, investment professionals, Legal, Compliance and Internal Audit can validate definitions and decision boundaries.' },
  { id: 'regional', title: 'Regional controls', text: 'EU/EEA residency, private connectivity and retained human authority remain binding.' },
  { id: 'formats', title: 'Format mapping', text: 'Portfolio and reporting formats can be mapped to a controlled canonical POC model without changing source systems.' },
]

const risks = [
  { id: 'quality', title: 'Data quality and variation', text: 'Incomplete, inconsistent or changing portfolio formats can weaken extraction, comparison and reporting.' },
  { id: 'exposure', title: 'Sensitive-data exposure', text: 'Incorrect access, residency or retention controls could expose confidential investment information.' },
  { id: 'grounding', title: 'Ungrounded AI output', text: 'Weak provenance or citations could create unsupported conclusions or false confidence.' },
  { id: 'dependencies', title: 'Dependency readiness', text: 'Identity, owner values, IPAM/DNS, quota, model and commercial decisions can delay implementation.' },
  { id: 'economics', title: 'Unproven economics', text: 'Performance, operating effort and Azure cost remain uncertain until tested with representative Stratton data.' },
]

const mitigations = [
  { id: 'profile', title: 'Profile before build', text: 'Profile the representative subset, document exceptions and agree a canonical POC mapping.' },
  { id: 'private', title: 'Private and least privilege', text: 'Use private endpoints, managed identities, RBAC/PIM, approved retention and no model-training use.' },
  { id: 'evidence', title: 'Evidence before decision', text: 'Require citations, provenance thresholds, evaluation evidence and retained human approval.' },
  { id: 'fail-closed', title: 'Fail closed on inputs', text: 'Block progress when accountable owners, dependencies or control evidence are missing.' },
  { id: 'poc', title: 'POC before scale', text: 'Measure quality, performance, operating effort and cost in non-production, then make an explicit scale decision.' },
]

export default function RisksMitigationsSlide({ index }) {
  return (
    <Slide index={index} className={styles.risksSlide}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      <div className={`${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />

        <header className={styles.header}>
          <Editable as="p" id="closing-risks.eyebrow" className={styles.eyebrow}>
            Decision readiness
          </Editable>
          <Editable as="h2" id="closing-risks.title" className={styles.title} multiline>
            Risks and Mitigations
          </Editable>
          <Editable as="p" id="closing-risks.subtitle" className={styles.subtitle} multiline>
            The architecture remains a working candidate: assumptions must be validated, material risks actively controlled and mitigations evidenced before any production commitment.
          </Editable>
        </header>

        <div className={styles.riskGrid} aria-label="Risk and mitigation readiness assessment">
          <section className={`${styles.riskColumn} ${styles.assumptionColumn}`} aria-label="Assumptions">
            <div className={styles.columnHeader}>
              <span className={styles.columnIcon} aria-hidden="true"><ClipboardCheck strokeWidth={1.7} /></span>
              <div>
                <div className={styles.columnTitleRow}>
                  <Editable as="h3" id="closing-risks.assumptions.heading">Assumptions</Editable>
                  <Editable as="span" id="closing-risks.assumptions.count" className={styles.countBadge}>4</Editable>
                </div>
                <Editable as="p" id="closing-risks.assumptions.lead" multiline>
                  Inputs that must be confirmed before the POC can be treated as representative.
                </Editable>
              </div>
            </div>

            <EditableList
              id="closing-risks.assumptions.items"
              items={assumptions}
              keyOf={(item) => item.id}
              className={styles.itemList}
              itemClassName={styles.itemShell}
            >
              {(item) => (
                <article className={styles.itemCard}>
                  <Editable as="h4" id={`closing-risks.assumptions.${item.id}.title`}>{item.title}</Editable>
                  <Editable as="p" id={`closing-risks.assumptions.${item.id}.text`} multiline>{item.text}</Editable>
                </article>
              )}
            </EditableList>
          </section>

          <section className={`${styles.riskColumn} ${styles.riskColumnCritical}`} aria-label="Risks">
            <div className={styles.columnHeader}>
              <span className={styles.columnIcon} aria-hidden="true"><TriangleAlert strokeWidth={1.7} /></span>
              <div>
                <div className={styles.columnTitleRow}>
                  <Editable as="h3" id="closing-risks.risks.heading">Risks</Editable>
                  <Editable as="span" id="closing-risks.risks.count" className={styles.countBadge}>5</Editable>
                </div>
                <Editable as="p" id="closing-risks.risks.lead" multiline>
                  Material issues that could weaken evidence, control or executive confidence.
                </Editable>
              </div>
            </div>

            <EditableList
              id="closing-risks.risks.items"
              items={risks}
              keyOf={(item) => item.id}
              className={styles.itemList}
              itemClassName={styles.itemShell}
            >
              {(item) => (
                <article className={styles.itemCard}>
                  <Editable as="h4" id={`closing-risks.risks.${item.id}.title`}>{item.title}</Editable>
                  <Editable as="p" id={`closing-risks.risks.${item.id}.text`} multiline>{item.text}</Editable>
                </article>
              )}
            </EditableList>
          </section>

          <section className={`${styles.riskColumn} ${styles.mitigationColumn}`} aria-label="Mitigations">
            <div className={styles.columnHeader}>
              <span className={styles.columnIcon} aria-hidden="true"><ShieldCheck strokeWidth={1.7} /></span>
              <div>
                <div className={styles.columnTitleRow}>
                  <Editable as="h3" id="closing-risks.mitigations.heading">Mitigations</Editable>
                  <Editable as="span" id="closing-risks.mitigations.count" className={styles.countBadge}>5</Editable>
                </div>
                <Editable as="p" id="closing-risks.mitigations.lead" multiline>
                  Evidence-led controls that keep the candidate design inside the agreed boundary.
                </Editable>
              </div>
            </div>

            <EditableList
              id="closing-risks.mitigations.items"
              items={mitigations}
              keyOf={(item) => item.id}
              className={styles.itemList}
              itemClassName={styles.itemShell}
            >
              {(item) => (
                <article className={styles.itemCard}>
                  <Editable as="h4" id={`closing-risks.mitigations.${item.id}.title`}>{item.title}</Editable>
                  <Editable as="p" id={`closing-risks.mitigations.${item.id}.text`} multiline>{item.text}</Editable>
                </article>
              )}
            </EditableList>
          </section>
        </div>

        <aside className={styles.footerCallout} aria-label="Decision readiness principle">
          <BadgeCheck aria-hidden="true" strokeWidth={1.75} />
          <Editable as="p" id="closing-risks.callout" multiline>
            Validate assumptions early · reduce irreversible commitments · scale only with evidence
          </Editable>
        </aside>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="closing-risks.footer">Stratton Europe Capital · Risks, assumptions and mitigations · Working candidate only</Editable>} />
    </Slide>
  )
}
