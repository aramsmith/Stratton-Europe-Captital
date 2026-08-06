import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { governanceGroups } from '../data/content.js'
import { claimIdsBySlide } from '../data/claims.js'
import styles from './GovernanceRisksSlide.module.css'

export default function GovernanceRisksSlide({ index }) {
  return (
    <Slide index={index} className={styles.governanceRisks}>
      <div className={`${styles.body} content-frame content-gutter`}>
        <div className={styles.header}>
          <Badge variant="outline"><Editable as="span" id="risk.eyebrow">Governance</Editable></Badge>
          <Editable as="h2" id="risk.title" className={styles.title}>Open boundaries remain explicit, unwaived and fail closed</Editable>
          <Editable as="p" id="risk.subtitle" className={styles.subtitle} multiline>The residual position is intentionally visible so endorsement cannot be mistaken for closure or operating effectiveness.</Editable>
          <span className={styles.claims}>Claims: {claimIdsBySlide.S09.join(' · ')}</span>
        </div>
        <EditableList id="risk.groups" items={governanceGroups} keyOf={(item) => item.id} className={styles.grid} itemClassName={styles.item}>
          {(item) => <Card><CardHeader><CardTitle className={styles.metric}><Editable as="span" id={`risk.groups.${item.id}.value`}>{item.value}</Editable></CardTitle><Editable as="h3" id={`risk.groups.${item.id}.title`}>{item.title}</Editable></CardHeader><CardContent><Editable as="p" id={`risk.groups.${item.id}.text`}>{item.text}</Editable></CardContent></Card>}
        </EditableList>
        <div className={styles.boundaries}>
          <Card><CardHeader><CardTitle><Editable as="span" id="risk.owners.title">Owner evidence still required</Editable></CardTitle></CardHeader><CardContent><Editable as="p" id="risk.owners.text">Legal applicability and mappings, approved locations, operating definitions, source inventory, assurance identities, release custody and trust evidence.</Editable></CardContent></Card>
          <Card><CardHeader><CardTitle><Editable as="span" id="risk.runtime.title">Future authorisation still required</Editable></CardTitle></CardHeader><CardContent><Editable as="p" id="risk.runtime.text">Retention finalisation, target validation, deployment, runtime testing and operating-effectiveness assessment.</Editable></CardContent></Card>
        </div>
        <Alert><AlertTitle><Editable as="span" id="risk.assurance.title">Assurance boundary</Editable></AlertTitle><AlertDescription><Editable as="span" id="risk.assurance.text">Coverage is architecture assurance — not legal advice, certification, attestation, waiver or approval.</Editable></AlertDescription></Alert>
      </div>
      <BottomBar text={<Editable as="span" id="risk.footer">Architecture decision executive brief</Editable>} />
    </Slide>
  )
}
