import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import cafOverview from '../data/approach/cloud-adoption-framework.png'
import togafAdm from '../data/approach/togaf-adm.png'
import wafHub from '../data/approach/well-architected-framework.png'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import styles from './MyApproachSlide.module.css'

const approachSteps = [
  {
    id: 'complexity',
    title: 'Frame the complexity',
    text: 'This case spans private equity, FSI, AI, sovereignty, regulation and cloud architecture. It demands deep investment-market and domain knowledge.',
  },
  {
    id: 'research',
    title: 'Research before prescription',
    text: 'I researched extensively rather than claim expertise in sovereignty, AIFMD or EU financial-services regulation.',
  },
  {
    id: 'interviews',
    title: 'Interview the experts',
    text: 'I interviewed domain architects and SMEs across FSI, sovereignty, security and compliance to challenge assumptions and shape the approach.',
  },
]

const foundationalFrameworks = [
  {
    id: 'togaf',
    title: 'TOGAF',
    text: 'Architecture method, requirements and governance.',
    href: 'https://www.opengroup.org/togaf',
    image: togafAdm,
    alt: 'TOGAF Architecture Development Method cycle from The Open Group',
  },
  {
    id: 'caf',
    title: 'Cloud Adoption Framework',
    text: 'Strategy, readiness, governance and adoption.',
    href: 'https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/overview',
    image: cafOverview,
    alt: 'Microsoft Cloud Adoption Framework overview',
  },
  {
    id: 'waf',
    title: 'Well-Architected Framework',
    text: 'Workload quality across the five architecture pillars.',
    href: 'https://learn.microsoft.com/en-us/azure/well-architected/',
    image: wafHub,
    alt: 'Microsoft Azure Well-Architected Framework hub',
  },
]

const referenceSources = [
  {
    id: 'architecture-centre',
    title: 'Azure Architecture Center',
    text: 'Reference architectures and best-practice guidance.',
    href: 'https://learn.microsoft.com/en-us/azure/architecture/',
  },
  {
    id: 'citadel',
    title: 'Foundry Citadel Platform',
    text: 'Azure Samples implementation for secure, governed AI agents.',
    href: 'https://github.com/Azure-Samples/foundry-citadel-platform',
  },
  {
    id: 'sovereign-policy',
    title: 'Sovereign Landing Zone policy framework',
    text: 'Policy layers for residency, encryption and security.',
    href: 'https://learn.microsoft.com/en-us/azure/azure-sovereign-clouds/public/design-sovereign-policies#azure-sovereign-landing-zone',
  },
]

const solutionAccelerators = [
  {
    id: 'chat-with-data',
    title: 'Chat with your Data',
    href: 'https://github.com/Azure-Samples/chat-with-your-data-solution-accelerator',
  },
  {
    id: 'investment-analysis',
    title: 'Agentic AI Investment Analyses',
    href: 'https://github.com/Azure-Samples/Agentic-AI-Investment-Analysis-Sample',
  },
]

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M14 5h5v5" />
      <path d="M19 5l-9 9" />
      <path d="M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" />
    </svg>
  )
}

function stopLinkPropagation(event) {
  event.stopPropagation()
}

export default function MyApproachSlide({ index }) {
  return (
    <Slide index={index} className={styles.myApproach}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      <div className={`${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />

        <header className={styles.header}>
          <Editable as="h2" id="approach.title" className={styles.title}>My approach</Editable>
          <Editable as="p" id="approach.subtitle" className={styles.subtitle} multiline>
            A research-led method: expert challenge, proven architecture guidance and an agentic architecture crew.
          </Editable>
        </header>

        <div className={styles.composition}>
          <section className={styles.approachPanel}>
            <Editable as="h3" id="approach.research.title" className={styles.verticalTitle}>Approach</Editable>
            <EditableList
              id="approach.research.steps"
              items={approachSteps}
              keyOf={(item) => item.id}
              className={styles.approachSteps}
              itemClassName={styles.approachStepShell}
            >
              {(item) => (
                <article className={styles.approachStep}>
                  <span className={styles.stepMarker} aria-hidden="true" />
                  <div>
                    <Editable as="h4" id={`approach.research.${item.id}.title`}>{item.title}</Editable>
                    <Editable as="p" id={`approach.research.${item.id}.text`} multiline>{item.text}</Editable>
                  </div>
                </article>
              )}
            </EditableList>
          </section>

          <section className={styles.frameworkPanel}>
            <div className={styles.frameworkHeader}>
              <Editable as="h3" id="approach.frameworks.title">Architecture &amp; solution frameworks in the mix</Editable>
              <Editable as="p" id="approach.frameworks.lead" multiline>
                The solution combines proven methods, Microsoft reference guidance and deployable governance patterns.
              </Editable>
            </div>

            <EditableList
              id="approach.frameworks.foundations"
              items={foundationalFrameworks}
              keyOf={(item) => item.id}
              className={styles.frameworkGallery}
              itemClassName={styles.frameworkItemShell}
            >
              {(item) => (
                <a
                  className={styles.frameworkItem}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${item.title} reference`}
                  onClick={stopLinkPropagation}
                >
                  <span className={styles.imageFrame}>
                    <img src={item.image} alt={item.alt} />
                  </span>
                  <span className={styles.frameworkCopy}>
                    <Editable as="strong" id={`approach.frameworks.${item.id}.title`}>{item.title}</Editable>
                    <Editable as="span" id={`approach.frameworks.${item.id}.text`}>{item.text}</Editable>
                  </span>
                  <span className={styles.externalIcon}><ExternalLinkIcon /></span>
                </a>
              )}
            </EditableList>

            <EditableList
              id="approach.frameworks.references"
              items={referenceSources}
              keyOf={(item) => item.id}
              className={styles.referenceList}
              itemClassName={styles.referenceItemShell}
            >
              {(item) => (
                <a
                  className={styles.referenceItem}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${item.title}`}
                  onClick={stopLinkPropagation}
                >
                  <Editable as="strong" id={`approach.references.${item.id}.title`}>{item.title}</Editable>
                  <Editable as="span" id={`approach.references.${item.id}.text`}>{item.text}</Editable>
                  <span className={styles.externalIcon}><ExternalLinkIcon /></span>
                </a>
              )}
            </EditableList>

            <div className={styles.solutionRow}>
              <section className={styles.acceleratorBlock}>
                <Editable as="strong" id="approach.accelerators.title">
                  Microsoft Solution Accelerators
                </Editable>
                <EditableList
                  id="approach.accelerators.items"
                  items={solutionAccelerators}
                  keyOf={(item) => item.id}
                  className={styles.acceleratorLinks}
                  itemClassName={styles.acceleratorItemShell}
                >
                  {(item) => (
                    <a
                      className={styles.acceleratorLink}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${item.title} solution accelerator`}
                      onClick={stopLinkPropagation}
                    >
                      <Editable as="span" id={`approach.accelerators.${item.id}.title`}>{item.title}</Editable>
                      <ExternalLinkIcon />
                    </a>
                  )}
                </EditableList>
              </section>

              <div className={styles.agenticCallout}>
                <span className={styles.calloutLead}>
                  <Editable as="span" id="approach.agentic.lead">
                    I needed an army of architects and engineers, so I created
                  </Editable>
                </span>
                <Editable as="strong" id="approach.agentic.title">
                  Solution 1: The Agentic Architecture Framework
                </Editable>
                <span className={styles.calloutActions}>
                  <a
                    className={styles.calloutAction}
                    href="https://github.com/aramsmith/agentic-architecture-v2"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open the Agentic Architecture Framework on GitHub"
                    onClick={stopLinkPropagation}
                  >
                    <Editable as="span" id="approach.agentic.github">View on GitHub</Editable>
                    <ExternalLinkIcon />
                  </a>
                  <a
                    className={styles.calloutAction}
                    href="https://aramsmith.github.io/agentic-architecture-v2/agentic-architecture-v2.html"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open the Agentic Architecture Framework web version"
                    onClick={stopLinkPropagation}
                  >
                    <Editable as="span" id="approach.agentic.web">Web version</Editable>
                    <ExternalLinkIcon />
                  </a>
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="approach.footer">Stratton Europe Capital · My approach</Editable>} />
    </Slide>
  )
}
