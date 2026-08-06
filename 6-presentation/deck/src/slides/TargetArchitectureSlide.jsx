import { BottomBar, Editable, Slide } from '@deckio/deck-engine'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import targetArchitecture from '../data/diagrams/target-application-architecture.svg'
import { claimIdsBySlide } from '../data/claims.js'
import styles from './TargetArchitectureSlide.module.css'

export default function TargetArchitectureSlide({ index }) {
  return (
    <Slide index={index} className={styles.targetArchitecture}>
      <div className={`${styles.body} content-frame content-gutter`}>
        <div className={styles.header}>
          <Badge variant="outline"><Editable as="span" id="target.eyebrow">TOGAF target</Editable></Badge>
          <Editable as="h2" id="target.title" className={styles.title}>Governed evidence flows to a draft — authority stays human</Editable>
          <Editable as="p" id="target.subtitle" className={styles.subtitle} multiline>Approved vendor-neutral application view: 19 Architecture Building Blocks and 10 architecture decisions.</Editable>
          <span className={styles.claims}>Claims: {claimIdsBySlide.S05.join(' · ')}</span>
        </div>
        <Card className={styles.diagramCard}><CardContent className={styles.diagramContent}><img src={targetArchitecture} alt="Approved vendor-neutral target application architecture showing controlled evidence flow, policy, audit and retained committee authority." /></CardContent></Card>
        <div className={styles.caption}><Editable as="span" id="target.caption">Policy and audit span the flow; the committee hand-off is explicitly non-automated.</Editable></div>
      </div>
      <BottomBar text={<Editable as="span" id="target.footer">Architecture decision executive brief</Editable>} />
    </Slide>
  )
}
