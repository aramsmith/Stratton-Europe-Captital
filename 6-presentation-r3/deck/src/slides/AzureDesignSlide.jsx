import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import azureTopology from '../data/diagrams/azure-landing-zone-topology.svg'
import { wafPillars } from '../data/content.js'
import { claimIdsBySlide } from '../data/claims.js'
import styles from './AzureDesignSlide.module.css'

export default function AzureDesignSlide({ index }) {
  return (
    <Slide index={index} className={styles.azureDesign}>
      <div className={`${styles.body} content-frame content-gutter`}>
        <div className={styles.header}>
          <Badge variant="outline"><Editable as="span" id="azure.eyebrow">Azure design</Editable></Badge>
          <Editable as="h2" id="azure.title" className={styles.title}>Private landing-zone integration with an isolated assurance boundary</Editable>
          <Editable as="p" id="azure.subtitle" className={styles.subtitle} multiline>The approved design separates platform, non-production, production and Internal Audit concerns; exact target values remain fail closed.</Editable>
          <span className={styles.claims}>Claims: {claimIdsBySlide.S06.join(' · ')}</span>
        </div>
        <div className={styles.layout}>
          <Card className={styles.diagramCard}><CardContent className={styles.diagramContent}><img src={azureTopology} alt="Approved Azure landing-zone topology with separated platform, non-production, production and assurance subscriptions." /></CardContent></Card>
          <EditableList id="azure.waf" items={wafPillars} keyOf={(item) => item.id} className={styles.waf} itemClassName={styles.item}>
            {(item) => <Card><CardContent className={styles.wafContent}><Badge variant="secondary"><Editable as="span" id={`azure.waf.${item.id}.label`}>{item.label}</Editable></Badge><Editable as="p" id={`azure.waf.${item.id}.text`}>{item.text}</Editable></CardContent></Card>}
          </EditableList>
        </div>
      </div>
      <BottomBar text={<Editable as="span" id="azure.footer">Architecture decision executive brief</Editable>} />
    </Slide>
  )
}
