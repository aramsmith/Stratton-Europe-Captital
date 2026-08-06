import { BottomBar, Editable, Slide } from '@deckio/deck-engine'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import styles from './ThankYouSlide.module.css'

export default function ThankYouSlide({ index }) {
  return (
    <Slide index={index} className={styles.thankYouSlide}>
      <div className="accent-bar" />

      <div className={`${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />
        <div className={styles.halo} aria-hidden="true" />

        <div className={styles.closingCopy}>
          <Editable as="p" id="closing-thanks.eyebrow" className={styles.eyebrow}>Becoming a Frontier Company</Editable>
          <Editable as="h2" id="closing-thanks.title" className={styles.title}>Thank you</Editable>
          <Editable as="p" id="closing-thanks.lead" className={styles.lead}>Thank you for having me.</Editable>
          <Editable as="p" id="closing-thanks.statement" className={styles.statement} multiline>
            Let’s bring Stratton to a Frontier company.
          </Editable>

          <div className={styles.questionCard}>
            <Editable as="strong" id="closing-thanks.questions" className={styles.questions}>Questions</Editable>
          </div>
        </div>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="closing-thanks.footer">Stratton Europe Capital · Thank you</Editable>} />
    </Slide>
  )
}
