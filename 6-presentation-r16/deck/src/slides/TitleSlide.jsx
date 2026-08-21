import { BottomBar, Editable, Slide } from '@deckio/deck-engine'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import strattonLogo from '../data/stratton-europe-capital-logo.png'
import styles from './TitleSlide.module.css'

export default function TitleSlide({ index }) {
  return (
    <Slide index={index} className={styles.titleSlide}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      <div className={`${styles.body} content-frame content-gutter`}>
        <div className={styles.logoFrame}>
          <img
            className={styles.logo}
            src={strattonLogo}
            alt="Stratton Europe Capital — Investing in Europe's Future"
          />
        </div>

        <div className={styles.copy}>
          <Editable as="span" id="title.eyebrow" className={styles.eyebrow}>AMA Case 18</Editable>
          <Editable as="h1" id="title.heading" className={styles.heading}>Stratton Europe Capital</Editable>
          <Editable as="p" id="title.subtitle" className={styles.subtitle}>Becoming a Frontier Company</Editable>
          <Editable as="p" id="title.journey" className={styles.journey} multiline>
            A sovereign Azure AI transformation blueprint for investment decision intelligence
          </Editable>
          <Editable as="p" id="title.intro" className={styles.intro} multiline>
            An architecture board briefing connecting governed evidence, expert review and retained human authority — from approved requirements to Azure design and an implementation package.
          </Editable>

          <div className={styles.tags} aria-label="Briefing scope">
            <Editable as="span" id="title.tags.architecture">Architecture journey</Editable>
            <Editable as="span" id="title.tags.azure">Azure target design</Editable>
            <Editable as="span" id="title.tags.authority">Human authority retained</Editable>
            <Editable as="span" id="title.tags.ai">AI driven</Editable>
          </div>
        </div>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="title.footer">Stratton Europe Capital · Architecture decision brief</Editable>} />
    </Slide>
  )
}
