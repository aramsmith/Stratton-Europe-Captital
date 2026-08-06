import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { contextStakeholders } from '../data/content.js'
import { claimIdsBySlide } from '../data/claims.js'
import styles from './BusinessContextSlide.module.css'

export default function BusinessContextSlide({ index }) {
  return (
    <Slide index={index} className={styles.businessContext}>
      <div className={`${styles.body} content-frame content-gutter`}>
        <div className={styles.header}>
          <Badge variant="outline"><Editable as="span" id="context.eyebrow">Context</Editable></Badge>
          <Editable as="h2" id="context.title" className={styles.title}>A bounded transformation with retained human authority</Editable>
          <Editable as="p" id="context.subtitle" className={styles.subtitle} multiline>Release 1 focuses on the first 20 eligible opportunities and a controlled evidence-to-draft journey.</Editable>
          <span className={styles.claims}>Claims: {claimIdsBySlide.S02.join(' · ')}</span>
        </div>
        <div className={styles.metrics}>
          <Card><CardHeader><CardTitle><Editable as="span" id="context.target.value">12 → ≤3 weeks</Editable></CardTitle></CardHeader><CardContent><Editable as="p" id="context.target.label">Approved median cycle-time target within 12 months — not achieved evidence.</Editable></CardContent></Card>
          <Card><CardHeader><CardTitle><Editable as="span" id="context.scope.value">20 opportunities</Editable></CardTitle></CardHeader><CardContent><Editable as="p" id="context.scope.label">First eligible new opportunities with deal and jurisdiction evidence.</Editable></CardContent></Card>
        </div>
        <EditableList id="context.stakeholders" items={contextStakeholders} keyOf={(item) => item.id} className={styles.grid} itemClassName={styles.item}>
          {(item) => <Card><CardHeader><CardTitle><Editable as="span" id={`context.stakeholders.${item.id}.title`}>{item.title}</Editable></CardTitle></CardHeader><CardContent><Editable as="p" id={`context.stakeholders.${item.id}.text`}>{item.text}</Editable></CardContent></Card>}
        </EditableList>
      </div>
      <BottomBar text={<Editable as="span" id="context.footer">Architecture decision executive brief</Editable>} />
    </Slide>
  )
}
