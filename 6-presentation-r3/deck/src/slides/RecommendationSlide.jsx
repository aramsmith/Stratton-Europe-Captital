import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { nextSteps } from '../data/content.js'
import { claimIdsBySlide } from '../data/claims.js'
import styles from './RecommendationSlide.module.css'

export default function RecommendationSlide({ index }) {
  return (
    <Slide index={index} className={styles.recommendation}>
      <div className={`${styles.body} content-frame content-gutter`}>
        <div className={styles.header}>
          <Badge variant="outline"><Editable as="span" id="recommendation.eyebrow">Recommendation</Editable></Badge>
          <Editable as="h2" id="recommendation.title" className={styles.title}>Endorse the controlled baseline and evidence-led roadmap</Editable>
          <Editable as="p" id="recommendation.subtitle" className={styles.subtitle} multiline>Keep optional deployment and runtime testing as separate, human-invocable decisions after owner evidence and authorised validation planning.</Editable>
          <span className={styles.claims}>Claims: {claimIdsBySlide.S10.join(' · ')}</span>
        </div>
        <EditableList id="recommendation.steps" items={nextSteps} keyOf={(item) => item.id} className={styles.steps} itemClassName={styles.item}>
          {(item) => <Card><CardHeader><Badge variant="secondary"><Editable as="span" id={`recommendation.steps.${item.id}.step`}>{item.step}</Editable></Badge><CardTitle><Editable as="span" id={`recommendation.steps.${item.id}.title`}>{item.title}</Editable></CardTitle></CardHeader><CardContent><Editable as="p" id={`recommendation.steps.${item.id}.text`}>{item.text}</Editable></CardContent></Card>}
        </EditableList>
        <Alert>
          <AlertTitle><Editable as="span" id="recommendation.ask.title">Board ask</Editable></AlertTitle>
          <AlertDescription><Editable as="span" id="recommendation.ask.text">Endorse the approved architecture and coding baseline, and sponsor the controlled roadmap. Do not approve deployment.</Editable></AlertDescription>
        </Alert>
        <div className={styles.boundary}><Editable as="span" id="recommendation.boundary">Phases 7 and 8 remain optional, separate, human-invocable and unauthorised.</Editable></div>
      </div>
      <BottomBar text={<Editable as="span" id="recommendation.footer">Architecture decision executive brief</Editable>} />
    </Slide>
  )
}
