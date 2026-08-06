import { BottomBar, Editable, Slide } from '@deckio/deck-engine'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { claimIdsBySlide } from '../data/claims.js'
import styles from './DecisionSummarySlide.module.css'

export default function DecisionSummarySlide({ index }) {
  return (
    <Slide index={index} className={styles.decisionSummary}>
      <div className={`${styles.body} content-frame content-gutter`}>
        <div className={styles.header}>
          <Badge variant="outline"><Editable as="span" id="decision.eyebrow">Board decision</Editable></Badge>
          <Editable as="h2" id="decision.title" className={styles.title}>Endorse the baseline — not deployment</Editable>
          <Editable as="p" id="decision.subtitle" className={styles.subtitle} multiline>Endorse the evidence-backed architecture and coding baseline as the controlled reference, with a gated roadmap for owner evidence and future validation — not deployment approval.</Editable>
          <span className={styles.claims}>Claims: {claimIdsBySlide.S01.join(' · ')}</span>
        </div>
        <Alert>
          <AlertTitle><Editable as="span" id="decision.ask.title">Decision requested</Editable></AlertTitle>
          <AlertDescription><Editable as="span" id="decision.ask.text">Endorse the approved baseline and controlled next-step roadmap. Do not authorise Azure activity.</Editable></AlertDescription>
        </Alert>
        <div className={styles.grid}>
          <Card><CardHeader><CardTitle><Editable as="span" id="decision.cards.evidence.title">Evidence chain</Editable></CardTitle></CardHeader><CardContent><Editable as="p" id="decision.cards.evidence.text">Approved requirements, target architecture, Azure design, delivery plan and Phase 5 package.</Editable></CardContent></Card>
          <Card><CardHeader><CardTitle><Editable as="span" id="decision.cards.status.title">Current status</Editable></CardTitle></CardHeader><CardContent><Editable as="p" id="decision.cards.status.text">Locally implemented and statically validated; no target or runtime evidence.</Editable></CardContent></Card>
          <Card><CardHeader><CardTitle><Editable as="span" id="decision.cards.boundary.title">Hard boundary</Editable></CardTitle></CardHeader><CardContent><Editable as="p" id="decision.cards.boundary.text">Three authority conflicts, fourteen owner controls and two retained minor gaps remain open and unwaived.</Editable></CardContent></Card>
        </div>
      </div>
      <BottomBar text={<Editable as="span" id="decision.footer">Architecture decision executive brief</Editable>} />
    </Slide>
  )
}
