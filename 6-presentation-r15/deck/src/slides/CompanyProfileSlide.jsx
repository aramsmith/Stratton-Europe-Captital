import { BottomBar, Editable, Slide } from '@deckio/deck-engine'
import AnimatedMetricValue from '../components/presentation/AnimatedMetricValue.jsx'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import styles from './CompanyProfileSlide.module.css'

const companyMetrics = [
  {
    id: 'aum',
    value: '€18bn',
    label: 'Assets under management',
    countUp: { to: 18, duration: 1600, delay: 1000, prefix: '€', suffix: 'bn' },
  },
  {
    id: 'portfolio',
    value: '34',
    label: 'Portfolio companies',
    countUp: { to: 34, duration: 1800, delay: 1200 },
  },
  {
    id: 'markets',
    value: '5',
    label: 'Central European markets',
    countUp: { to: 5, duration: 1900, delay: 1400 },
  },
  { id: 'headquarters', value: 'Vienna', label: 'Headquarters' },
]

const currentPosition = [
  {
    id: 'footprint',
    title: 'Five-country operating footprint',
    text: 'Stratton operates across Austria, Germany, Switzerland, the Czech Republic and Hungary.',
  },
  {
    id: 'portfolio',
    title: '34 portfolio companies',
    text: 'Vienna-based investment teams oversee 34 portfolio companies across the region.',
  },
  {
    id: 'vehicles',
    title: 'Luxembourg fund vehicles',
    text: 'Luxembourg-based fund vehicles operate within an AIFMD reporting context (Alternative Investment Fund Managers Directive).',
  },
  {
    id: 'estate',
    title: 'Legacy on-premises estate',
    text: 'The current on-premises technology solution is outdated and at end of life, potentially exposing Stratton to substantial renewal CAPEX.',
  },
]

const businessChallenges = [
  { id: 'diligence', title: 'Due diligence', text: 'Now it takes 12 weeks and consumes 60% of deal-team capacity.' },
  { id: 'monitoring', title: 'Portfolio monitoring', text: 'Quarterly manual reporting with no real-time signals.' },
  { id: 'esg', title: 'ESG and SFDR', text: 'Inconsistent data formats across 34 portfolio companies.' },
  { id: 'sourcing', title: 'Deal sourcing', text: 'Personal networks without systematic market intelligence.' },
  { id: 'aifmd', title: 'Regulatory reporting', text: 'AIFMD documentation for Luxembourg fund vehicles.' },
]

const operatingEcosystem = [
  'Investment and deal teams',
  'Portfolio company leadership',
  'Fund operations',
  'Regulatory stakeholders',
]

export default function CompanyProfileSlide({ index }) {
  return (
    <Slide index={index} className={styles.companyProfile}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      <div className={`${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />
        <header className={styles.header}>
          <Editable as="span" id="company.eyebrow" className={styles.eyebrow}>Company profile · Case Study 18</Editable>
          <Editable as="h2" id="company.title" className={styles.title}>Stratton Europe Capital — at a glance</Editable>
          <Editable as="p" id="company.subtitle" className={styles.subtitle} multiline>
            A fictitious Vienna-based private-equity fund.
          </Editable>
        </header>

        <div className={styles.profileGrid}>
          <section className={styles.storyPanel}>
            <Editable as="span" id="company.story.kicker" className={styles.sectionLabel}>Our story</Editable>
            <Editable as="p" id="company.story.text" className={styles.story} multiline>
              Headquartered in Vienna, Stratton operates across Austria, Germany, Switzerland, the Czech Republic and Hungary. Its investment-management structure includes Luxembourg-based fund vehicles within an AIFMD reporting context.
            </Editable>
            <div className={styles.metrics}>
              {companyMetrics.map((metric) => (
                <article className={styles.metric} key={metric.id}>
                  {metric.countUp ? (
                    <AnimatedMetricValue
                      index={index}
                      editableId={`company.metrics.${metric.id}.value`}
                      {...metric.countUp}
                    />
                  ) : (
                    <Editable as="strong" id={`company.metrics.${metric.id}.value`}>{metric.value}</Editable>
                  )}
                  <Editable as="span" id={`company.metrics.${metric.id}.label`}>{metric.label}</Editable>
                </article>
              ))}
            </div>
            <Editable as="p" id="company.metrics.note" className={styles.fictionNote}>
              All figures and company facts shown are sourced from Case Study 18.
            </Editable>
          </section>

          <section className={styles.positionPanel}>
            <div className={styles.positionHeader}>
              <Editable as="span" id="company.position.kicker" className={styles.sectionLabel}>Where Stratton is today</Editable>
              <div className={styles.ecosystemInline}>
                <Editable as="span" id="company.clients.kicker" className={styles.clientLabel}>Operating ecosystem</Editable>
                <div className={styles.clients}>
                  {operatingEcosystem.map((participant, participantIndex) => (
                    <Editable as="span" id={`company.ecosystem.${participantIndex}`} key={participant}>{participant}</Editable>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.positionList}>
              {currentPosition.map((item) => (
                <article className={styles.positionItem} key={item.id}>
                  <Editable as="h3" id={`company.position.${item.id}.title`}>{item.title}</Editable>
                  <Editable as="p" id={`company.position.${item.id}.text`}>{item.text}</Editable>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.challengesPanel}>
            <Editable as="span" id="company.challenges.kicker" className={`${styles.sectionLabel} ${styles.challengeLabel}`}>
              Business challenges
            </Editable>
            <div className={styles.challengeList}>
              {businessChallenges.map((challenge) => (
                <article className={styles.challengeItem} key={challenge.id}>
                  <Editable as="h3" id={`company.challenges.${challenge.id}.title`}>{challenge.title}</Editable>
                  <Editable as="p" id={`company.challenges.${challenge.id}.text`}>{challenge.text}</Editable>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="company.footer">Stratton Europe Capital · Company context and business challenges</Editable>} />
    </Slide>
  )
}
