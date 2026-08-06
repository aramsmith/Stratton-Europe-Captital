import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import deliveryDag from '../data/diagrams/delivery-dependency-dag.svg'
import { validationSignals } from '../data/content.js'
import { claimIdsBySlide } from '../data/claims.js'
import styles from './DeliveryReadinessSlide.module.css'

export default function DeliveryReadinessSlide({ index }) {
  return (
    <Slide index={index} className={styles.deliveryReadiness}>
      <div className={`${styles.body} content-frame content-gutter`}>
        <div className={styles.header}>
          <Badge variant="outline"><Editable as="span" id="delivery.eyebrow">Delivery</Editable></Badge>
          <Editable as="h2" id="delivery.title" className={styles.title}>The package is built and locally validated — the target is not</Editable>
          <Editable as="p" id="delivery.subtitle" className={styles.subtitle} multiline>Approved sequence: 17 deployable units, five work packages and 46 acyclic dependencies.</Editable>
          <span className={styles.claims}>Claims: {claimIdsBySlide.S07.join(' · ')}</span>
        </div>
        <Card className={styles.dagCard}><CardContent className={styles.dagContent}><img src={deliveryDag} alt="Approved dependency graph for 17 deployable units and 46 acyclic dependencies." /></CardContent></Card>
        <EditableList id="delivery.signals" items={validationSignals} keyOf={(item) => item.id} className={styles.metrics} itemClassName={styles.item}>
          {(item) => <Card><CardHeader><CardTitle><Editable as="span" id={`delivery.signals.${item.id}.value`}>{item.value}</Editable></CardTitle></CardHeader><CardContent><Editable as="strong" id={`delivery.signals.${item.id}.label`}>{item.label}</Editable><Editable as="p" id={`delivery.signals.${item.id}.detail`}>{item.detail}</Editable></CardContent></Card>}
        </EditableList>
        <Alert><AlertTitle><Editable as="span" id="delivery.boundary.title">Readiness boundary</Editable></AlertTitle><AlertDescription><Editable as="span" id="delivery.boundary.text">No Azure sign-in, target validation, what-if, deployment, retention finalisation, cloud validation or runtime testing occurred.</Editable></AlertDescription></Alert>
      </div>
      <BottomBar text={<Editable as="span" id="delivery.footer">Architecture decision executive brief</Editable>} />
    </Slide>
  )
}
