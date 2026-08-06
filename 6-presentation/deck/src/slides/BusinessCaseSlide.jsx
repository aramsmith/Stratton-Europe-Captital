import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { businessInputs } from '../data/content.js'
import { claimIdsBySlide } from '../data/claims.js'
import styles from './BusinessCaseSlide.module.css'

export default function BusinessCaseSlide({ index }) {
  return (
    <Slide index={index} className={styles.businessCase}>
      <div className={`${styles.body} content-frame content-gutter`}>
        <div className={styles.header}>
          <Badge variant="outline"><Editable as="span" id="case.eyebrow">Business case</Editable></Badge>
          <Editable as="h2" id="case.title" className={styles.title}>No approved numeric case exists — owner inputs come first</Editable>
          <Editable as="p" id="case.subtitle" className={styles.subtitle} multiline>Costs, benefits, assumptions and sensitivities must be grounded in dated owner-approved sources; no placeholder numbers are presented.</Editable>
          <span className={styles.claims}>Claims: {claimIdsBySlide.S08.join(' · ')}</span>
        </div>
        <Alert>
          <AlertTitle><Editable as="span" id="case.alert.title">Financial evidence boundary</Editable></AlertTitle>
          <AlertDescription><Editable as="span" id="case.alert.text">No approved ROI, Azure price, rate, cost total or realised benefit exists.</Editable></AlertDescription>
        </Alert>
        <EditableList id="case.inputs" items={businessInputs} keyOf={(item) => item.id} className={styles.grid} itemClassName={styles.item}>
          {(item) => <Card><CardHeader><CardTitle><Editable as="span" id={`case.inputs.${item.id}.owner`}>{item.owner}</Editable></CardTitle></CardHeader><CardContent><Editable as="p" id={`case.inputs.${item.id}.input`}>{item.input}</Editable></CardContent></Card>}
        </EditableList>
        <div className={styles.sensitivities}><Editable as="strong" id="case.sensitivities.title">Principal sensitivities:</Editable> <Editable as="span" id="case.sensitivities.text">regional selection, resilience posture, document volume, model quota, processing hours, support model, licensing and adoption.</Editable></div>
      </div>
      <BottomBar text={<Editable as="span" id="case.footer">Architecture decision executive brief</Editable>} />
    </Slide>
  )
}
