import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import {
  ArrowDownRight,
  Calculator,
  Coins,
  TrendingUp,
} from 'lucide-react'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import {
  azureAnnualTotal,
  azureCostCategories,
  azureMonthlyTotal,
  azurePricingMeta,
  onPremMock,
  pricingAssumptions,
} from '../data/azurePricing.js'
import styles from '../styles/PhaseSummarySlides.module.css'
import slideStyles from './CostsBenefitsSlide.module.css'

const benefitMappings = [
  {
    id: 'capex',
    category: 'Avoided/deferred CapEx',
    challenge: 'Legacy on-prem renewal exposure',
    architecturalResponse: 'PAYG Azure estimate, evidence-led sizing and FinOps controls.',
    projectedBenefit: 'Avoided or deferred renewal CapEx; comparator is illustrative, not a quote.',
    measurementMethod: 'Compare approved on-prem renewal quote with Azure Pricing Calculator and Azure Cost Management actuals after deployment.',
  },
  {
    id: 'cycle-time',
    category: 'Cycle time',
    challenge: '12-week due diligence consumes 60% of deal-team capacity',
    architecturalResponse: 'Case workflow, governed evidence ingestion, extraction, risk/ESG analysis, citation and draft recommendation.',
    projectedBenefit: 'Target: median due diligence no more than 3 weeks for first 20 eligible deals.',
    measurementMethod: 'Workflow timestamps from formal case opening to investment-committee-ready recommendation; median <= 21 calendar days.',
  },
  {
    id: 'security',
    category: 'Security',
    challenge: 'Highly confidential data, sovereignty, transfer and privileged-access risk',
    architecturalResponse: 'Private paths, public endpoint denial, EU/EEA location gates, least privilege, PIM and audit.',
    projectedBenefit: 'Reduced exposure and stronger auditable control posture.',
    measurementMethod: 'Policy compliance, resource inventory, access review, transfer register and negative-test evidence.',
  },
  {
    id: 'governance-decision-quality',
    category: 'Governance + decision quality',
    challenge: 'Unsupported claims, AI autonomy risk and unclear decision rights',
    architecturalResponse: 'Evidence envelope, citation, mandatory human/specialist review, draft-only state and Internal Audit verdict boundary.',
    projectedBenefit: 'Better-governed committee-ready drafts with human authority retained.',
    measurementMethod: '100% citations; required approvals; zero system-issued investment decisions; Internal Audit verdict.',
  },
]

const formatK = (value) => `$${(value / 1000).toFixed(1)}K`

export default function CostsBenefitsSlide({ index }) {
  const annualGap = onPremMock.annualTotal - azureAnnualTotal

  return (
    <Slide index={index} className={`${styles.phaseSlide} ${styles.costSlide} ${slideStyles.costsBenefitsSlide}`}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      <div className={`${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />

        <header className={styles.header}>
          <Editable as="p" id="costs-benefits.eyebrow" className={styles.eyebrow}>
            Illustrative economics · transparent assumptions
          </Editable>
          <Editable as="h2" id="costs-benefits.title" className={styles.title} multiline>
            Costs and Benefits
          </Editable>
          <Editable as="p" id="costs-benefits.subtitle" className={styles.subtitle} multiline>
            A live public-retail Azure estimate shows the cost shape of the approved design; the on-premises comparator is illustrative only, not a customer quote, procurement estimate or assured business case.
          </Editable>
        </header>

        <div className={styles.costGrid}>
          <section className={`${styles.surface} ${styles.azureCostPanel}`}>
            <div className={styles.costHero}>
              <div className={styles.calculatorIcon}><Calculator aria-hidden="true" strokeWidth={1.65} /></div>
              <div>
                <Editable as="span" id="costs-benefits.azure.label" className={styles.cardLabel}>Azure estimated run rate</Editable>
                <div className={styles.costHeadline}>
                  <Editable as="strong" id="costs-benefits.azure.monthly">{formatK(azureMonthlyTotal)}</Editable>
                  <Editable as="span" id="costs-benefits.azure.monthly-unit">/ month</Editable>
                </div>
                <Editable as="p" id="costs-benefits.azure.annual">{formatK(azureAnnualTotal)} per year · USD · PAYG public retail</Editable>
              </div>
              <span className={styles.liveApiTag}>
                <span aria-hidden="true" />
                <Editable as="span" id="costs-benefits.azure.api">LIVE API RATES</Editable>
              </span>
            </div>

            <div className={styles.costStack} aria-label="Azure monthly cost distribution">
              {azureCostCategories.map((item) => (
                <span
                  key={item.id}
                  className={styles.costSegment}
                  style={{
                    '--segment-color': item.color,
                    '--segment-width': `${(item.monthly / azureMonthlyTotal) * 100}%`,
                  }}
                />
              ))}
            </div>

            <EditableList
              id="costs-benefits.azure.categories"
              items={azureCostCategories}
              keyOf={(item) => item.id}
              className={styles.costRows}
              itemClassName={styles.costRowShell}
            >
              {(item) => (
                <article className={styles.costRow}>
                  <span className={styles.costSwatch} style={{ '--segment-color': item.color }} aria-hidden="true" />
                  <div>
                    <Editable as="strong" id={`costs-benefits.azure.categories.${item.id}.label`}>{item.label}</Editable>
                    <Editable as="span" id={`costs-benefits.azure.categories.${item.id}.detail`} multiline>{item.detail}</Editable>
                  </div>
                  <Editable as="strong" id={`costs-benefits.azure.categories.${item.id}.monthly`}>
                    ${Math.round(item.monthly).toLocaleString('en-US')}
                  </Editable>
                </article>
              )}
            </EditableList>

            <div className={styles.pricingSource}>
              <Editable as="strong" id="costs-benefits.source.title">Microsoft Azure Retail Prices API</Editable>
              <Editable as="span" id="costs-benefits.source.detail" multiline>
                api-version {azurePricingMeta.apiVersion} · {azurePricingMeta.region} · queried {azurePricingMeta.queriedAt} · {azurePricingMeta.basis}
              </Editable>
            </div>
          </section>

          <aside className={styles.costSide}>
            <section className={`${styles.surface} ${styles.onPremPanel}`}>
              <div className={styles.onPremHeading}>
                <div>
                  <Editable as="span" id="costs-benefits.onprem.label" className={styles.cardLabel}>Illustrative on-premises comparator</Editable>
                  <Editable as="strong" id="costs-benefits.onprem.total">{formatK(onPremMock.annualTotal)} / year</Editable>
                </div>
                <span className={styles.premiumBadge}>
                  <TrendingUp aria-hidden="true" strokeWidth={1.7} />
                  <Editable as="span" id="costs-benefits.onprem.premium">+{onPremMock.premiumPercent}%</Editable>
                </span>
              </div>

              <div className={styles.onPremBars}>
                <div className={styles.onPremBarRow}>
                  <div>
                    <Editable as="strong" id="costs-benefits.onprem.opex.label">OPEX</Editable>
                    <Editable as="span" id="costs-benefits.onprem.opex.detail">people · licences · facilities · support</Editable>
                  </div>
                  <div className={styles.onPremTrack}><span style={{ '--bar-width': '59%' }} /></div>
                  <Editable as="strong" id="costs-benefits.onprem.opex.value">{formatK(onPremMock.annualOpex)}</Editable>
                </div>
                <div className={styles.onPremBarRow}>
                  <div>
                    <Editable as="strong" id="costs-benefits.onprem.capex.label">CAPEX renewal</Editable>
                    <Editable as="span" id="costs-benefits.onprem.capex.detail">compute · storage · network refresh</Editable>
                  </div>
                  <div className={styles.onPremTrack}><span style={{ '--bar-width': '41%' }} /></div>
                  <Editable as="strong" id="costs-benefits.onprem.capex.value">{formatK(onPremMock.annualCapexRenewal)}</Editable>
                </div>
              </div>

              <div className={styles.gapCallout}>
                <ArrowDownRight aria-hidden="true" strokeWidth={1.7} />
                <div>
                  <Editable as="strong" id="costs-benefits.gap.value">{formatK(annualGap)}</Editable>
                  <Editable as="span" id="costs-benefits.gap.label">illustrative annual gap versus on-premises comparator</Editable>
                </div>
              </div>
            </section>

            <section className={`${styles.surface} ${styles.assumptionsPanel}`}>
              <div className={styles.assumptionHeading}>
                <Coins aria-hidden="true" strokeWidth={1.7} />
                <Editable as="strong" id="costs-benefits.assumptions.title">Workload assumptions</Editable>
              </div>
              <EditableList
                id="costs-benefits.assumptions"
                items={pricingAssumptions.map((text, itemIndex) => ({ id: `item-${itemIndex + 1}`, text }))}
                keyOf={(item) => item.id}
                className={styles.assumptionList}
                itemClassName={styles.assumptionShell}
              >
                {(item) => (
                  <span className={styles.assumptionItem}>
                    <span aria-hidden="true" />
                    <Editable as="span" id={`costs-benefits.assumptions.${item.id}`} multiline>{item.text}</Editable>
                  </span>
                )}
              </EditableList>
            </section>
          </aside>
        </div>

        <Editable as="p" id="costs-benefits.projection-caveat" className={styles.projectionCaveat} multiline>
          Projected / enabled only — no deployed runtime benefit is claimed.
        </Editable>

        <EditableList
          id="costs-benefits.matrix"
          items={benefitMappings}
          keyOf={(item) => item.id}
          className={styles.benefitMatrix}
          itemClassName={styles.benefitMatrixShell}
        >
          {(item) => (
            <article className={styles.benefitMatrixCard}>
              <Editable as="span" id={`costs-benefits.matrix.${item.id}.category`} className={styles.benefitMatrixCategory}>{item.category}</Editable>
              <Editable as="h3" id={`costs-benefits.matrix.${item.id}.benefit`} className={styles.benefitMatrixHeadline} multiline>{item.projectedBenefit}</Editable>
              <div className={styles.benefitMatrixBody}>
                <Editable as="span" id={`costs-benefits.matrix.${item.id}.measure`} className={styles.benefitMeasure} multiline>{item.measurementMethod}</Editable>
              </div>
            </article>
          )}
        </EditableList>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="costs-benefits.footer">Stratton Europe Capital · Illustrative Azure costs and projected benefits</Editable>} />
    </Slide>
  )
}
