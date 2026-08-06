import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { alternatives } from '../data/content.js'
import { claimIdsBySlide } from '../data/claims.js'
import styles from './ArchitectureChoiceSlide.module.css'

export default function ArchitectureChoiceSlide({ index }) {
  return (
    <Slide index={index} className={styles.architectureChoice}>
      <div className={`${styles.body} content-frame content-gutter`}>
        <div className={styles.header}>
          <Badge variant="outline"><Editable as="span" id="choice.eyebrow">Architecture choice</Editable></Badge>
          <Editable as="h2" id="choice.title" className={styles.title}>Control is designed into every material boundary</Editable>
          <Editable as="p" id="choice.subtitle" className={styles.subtitle} multiline>The approved pattern deliberately rejects shortcuts that weaken authority, evidence or environment isolation.</Editable>
          <span className={styles.claims}>Claims: {claimIdsBySlide.S04.join(' · ')}</span>
        </div>
        <EditableList id="choice.alternatives" items={alternatives} keyOf={(item) => item.id} className={styles.grid} itemClassName={styles.item}>
          {(item) => <Card className={item.id === 'chosen' ? styles.chosen : undefined}><CardHeader><Badge variant={item.id === 'chosen' ? 'default' : 'outline'}><Editable as="span" id={`choice.alternatives.${item.id}.label`}>{item.label}</Editable></Badge><CardTitle><Editable as="span" id={`choice.alternatives.${item.id}.title`}>{item.title}</Editable></CardTitle></CardHeader><CardContent><Editable as="p" id={`choice.alternatives.${item.id}.text`}>{item.text}</Editable></CardContent></Card>}
        </EditableList>
        <div className={styles.tradeoff}><Editable as="strong" id="choice.tradeoff.title">Trade-off:</Editable> <Editable as="span" id="choice.tradeoff.text">stronger evidence, isolation and human control in exchange for more gates, identities, operating complexity and release latency.</Editable></div>
      </div>
      <BottomBar text={<Editable as="span" id="choice.footer">Architecture decision executive brief</Editable>} />
    </Slide>
  )
}
