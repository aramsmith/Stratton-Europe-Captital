import strattonLogo from '../../data/stratton-europe-capital-logo.png'
import styles from './StrattonBrandMark.module.css'

export default function StrattonBrandMark() {
  return (
    <div className={styles.mark} aria-label="Stratton Europe Capital">
      <img
        className={styles.logo}
        src={strattonLogo}
        alt="Stratton Europe Capital"
      />
    </div>
  )
}
