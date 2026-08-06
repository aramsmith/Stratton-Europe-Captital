import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { valuePillars } from '../data/content.js'
import { claimIdsBySlide } from '../data/claims.js'
import styles from './ValueLogicSlide.module.css'

export default function ValueLogicSlide({ index }) {
  return (
    <Slide index={index} className={styles.valueLogic}>
      <div className={`${styles.body} content-frame content-gutter`}>
        <div className={styles.header}>
          <Badge variant="outline"><Editable as="span" id="value.eyebrow">Value logic</Editable></Badge>
          <Editable as="h2" id="value.title" className={styles.title}>Speed through governed reuse — quality through explicit control</Editable>
          <Editable as="p" id="value.subtitle" className={styles.subtitle} multiline>The architecture supports a measurable value hypothesis without asserting ROI or realised benefit.</Editable>
          <span className={styles.claims}>Claims: {claimIdsBySlide.S03.join(' · ')}</span>
        </div>
        <div className={styles.flow}>
          <Badge variant="secondary"><Editable as="span" id="value.flow.sources">Governed sources</Editable></Badge><span>→</span>
          <Badge variant="secondary"><Editable as="span" id="value.flow.analysis">Grounded assistive analysis</Editable></Badge><span>→</span>
          <Badge variant="secondary"><Editable as="span" id="value.flow.review">Human review</Editable></Badge><span>→</span>
          <Badge variant="secondary"><Editable as="span" id="value.flow.draft">Committee-ready draft</Editable></Badge>
        </div>
        <EditableList id="value.pillars" items={valuePillars} keyOf={(item) => item.id} className={styles.grid} itemClassName={styles.item}>
          {(item) => <Card><CardHeader><CardTitle><Editable as="span" id={`value.pillars.${item.id}.title`}>{item.title}</Editable></CardTitle></CardHeader><CardContent><Editable as="p" id={`value.pillars.${item.id}.text`}>{item.text}</Editable></CardContent></Card>}
        </EditableList>
        <Alert>
          <AlertTitle><Editable as="span" id="value.hypothesis.title">Human-owned hypothesis</Editable></AlertTitle>
          <AlertDescription><Editable as="span" id="value.hypothesis.text">Accountable owners must validate cycle time, effort, quality and exceptions against dated evidence before any benefit claim.</Editable></AlertDescription>
        </Alert>
      </div>
      <BottomBar text={<Editable as="span" id="value.footer">Architecture decision executive brief</Editable>} />
    </Slide>
  )
}
