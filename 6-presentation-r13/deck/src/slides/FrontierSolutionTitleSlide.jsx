import { BottomBar, Editable, Slide } from '@deckio/deck-engine'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import azureAiFoundryLogo from '../data/azure-ai-foundry-logo.svg'
import azureLogo from '../data/azure-logo.svg'
import githubCopilotPilot from '../data/github-copilot-pilot.png'
import microsoftCopilotLogo from '../data/microsoft-copilot-logo.svg'
import strattonRoundLogo from '../data/stratton-round-logo.png'
import styles from './FrontierSolutionTitleSlide.module.css'

export default function FrontierSolutionTitleSlide({ index }) {
  return (
    <Slide index={index} className={styles.frontierSolutionTitle}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      <div className={`${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />

        <div className={styles.composition}>
          <div className={styles.copy}>
            <Editable as="h2" id="frontier-solution.title" className={styles.title} multiline>
              The Stratton Europe Capital Frontier Company Solution
            </Editable>

            <Editable as="p" id="frontier-solution.subtitle" className={styles.subtitle} multiline>
              A sovereign Azure AI operating platform where trusted data, specialist agents and human judgement work as one governed investment capability—accelerating decisions, scaling portfolio value creation and enabling Stratton&apos;s next generation of services.
            </Editable>

            <div className={styles.definition}>
              <span className={styles.definitionRule} aria-hidden="true" />
              <Editable as="p" id="frontier-solution.definition">
                Trusted data · Specialist agents · Retained human authority
              </Editable>
            </div>
          </div>

          <div className={styles.visualColumn}>
            <div
              className={styles.frontierVisual}
              role="img"
              aria-label="GitHub Copilot, Microsoft Copilot, Azure AI Foundry and Microsoft Azure working within one governed frontier system"
            >
              <div className={`${styles.orbitRing} ${styles.orbitOuter}`} aria-hidden="true" />
              <div className={`${styles.orbitRing} ${styles.orbitMiddle}`} aria-hidden="true" />
              <div className={`${styles.orbitRing} ${styles.orbitInner}`} aria-hidden="true" />
              <div className={styles.horizon} aria-hidden="true" />
              <div className={styles.frontierCore} aria-hidden="true">
                <img className={styles.frontierLogo} src={strattonRoundLogo} alt="" />
              </div>

              <div className={`${styles.flyerOrbit} ${styles.githubOrbit}`}>
                <div className={styles.flyerAnchor}>
                  <div className={styles.flyerPose}>
                    <div className={styles.githubPilot}>
                      <img src={githubCopilotPilot} alt="" />
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${styles.flyerOrbit} ${styles.microsoftOrbit}`}>
                <div className={styles.flyerAnchor}>
                  <div className={styles.flyerPose}>
                    <div className={`${styles.logoObject} ${styles.microsoftCopilot}`}>
                      <div className={styles.logoPlate}>
                        <img src={microsoftCopilotLogo} alt="" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${styles.flyerOrbit} ${styles.foundryOrbit}`}>
                <div className={styles.flyerAnchor}>
                  <div className={styles.flyerPose}>
                    <div className={`${styles.logoObject} ${styles.azureFoundry}`}>
                      <div className={styles.logoPlate}>
                        <img src={azureAiFoundryLogo} alt="" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${styles.flyerOrbit} ${styles.azurePlatformOrbit}`}>
                <div className={styles.flyerAnchor}>
                  <div className={styles.flyerPose}>
                    <div className={`${styles.logoObject} ${styles.azurePlatform}`}>
                      <div className={styles.logoPlate}>
                        <img src={azureLogo} alt="" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Editable as="p" id="frontier-solution.visual-caption" className={styles.visualCaption}>
              One governed investment capability
            </Editable>
          </div>
        </div>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="frontier-solution.footer">Stratton Europe Capital · Frontier company solution</Editable>} />
    </Slide>
  )
}
