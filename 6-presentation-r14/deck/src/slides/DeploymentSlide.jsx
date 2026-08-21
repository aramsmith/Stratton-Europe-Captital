import { BottomBar, Editable, EditableList, Slide } from '@deckio/deck-engine'
import {
  ArrowRight,
  CircleStop,
  ClipboardCheck,
  CloudUpload,
  FileKey2,
  GitBranch,
  RotateCcw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import PresentationStatus from '../components/presentation/PresentationStatus.jsx'
import StrattonBrandMark from '../components/presentation/StrattonBrandMark.jsx'
import managementGroupsIcon from '../data/azure-icons/management-groups.svg'
import monitorIcon from '../data/azure-icons/monitor.svg'
import policyIcon from '../data/azure-icons/policy.svg'
import styles from '../styles/PhaseSummarySlides.module.css'
import slideStyles from './DeploymentSlide.module.css'

const deploymentSteps = [
  { id: 'authorise', number: '01', icon: UserCheck, title: 'Authorise scope', text: 'Human architect invokes Phase 7 for one tenant, subscription set and attempt.', gate: 'HUMAN' },
  { id: 'bind', number: '02', icon: FileKey2, title: 'Bind owner values', text: 'Regions, IPAM, identities, budgets and operating windows are signed.', gate: 'OWNERS' },
  { id: 'validate', number: '03', icon: ClipboardCheck, title: 'Validate package', text: 'Hashes, prerequisites, policy, Bicep and release evidence must match.', gate: 'STOP-ON-FAIL' },
  { id: 'whatif', number: '04', icon: GitBranch, title: 'Run what-if', text: 'Tenant and stage changes are reviewed before any resource mutation.', gate: 'APPROVE' },
  { id: 'deploy', number: '05', icon: CloudUpload, title: 'Deploy in dependency order', text: 'Deploy each package unit only after its prerequisites; a failed stage stops every dependent stage.', gate: 'CONTROLLED' },
  { id: 'evidence', number: '06', icon: ShieldCheck, title: 'Seal evidence', text: 'Capture IDs, outputs, policy state, hashes and rollback decision.', gate: 'ASSURE' },
]

const deployPackageUnits = [
  { id: 'du-01', du: `DU-${String(1).padStart(2, '0')}`, component: 'Hierarchy', status: 'PACKAGED', note: 'Tenant-scope Bicep candidate' },
  { id: 'du-02', du: 'DU-02', component: 'Guardrails', status: 'PACKAGED', note: 'Policy baseline candidate' },
  { id: 'du-03', du: 'DU-03', component: 'Resource groups', status: 'PACKAGED', note: 'Naming, tags and locations' },
  { id: 'du-04', du: 'DU-04', component: 'Network foundation', status: 'OWNER INPUTS', note: 'IPAM/WAN evidence required' },
  { id: 'du-05', du: 'DU-05', component: 'Private DNS', status: 'OWNER INPUTS', note: 'DNS ownership and resolver inputs' },
  { id: 'du-06', du: 'DU-06', component: 'Identity/RBAC', status: 'GATED', note: 'Separated role executor required' },
  { id: 'du-07', du: 'DU-07', component: 'Governance', status: 'PACKAGED', note: 'Support and retention parameters' },
  { id: 'du-08', du: 'DU-08', component: 'Monitoring', status: 'PACKAGED', note: 'Diagnostics and alerting candidate' },
  { id: 'du-09', du: 'DU-09', component: 'Data/recovery', status: 'OWNER INPUTS', note: 'Backup/recovery values required' },
  { id: 'du-10', du: 'DU-10', component: 'Integration', status: 'PACKAGED', note: 'No admitted route yet' },
  { id: 'du-11', du: 'DU-11', component: 'Regional AI', status: 'OWNER INPUTS', note: 'Model/provider/quota evidence required' },
  { id: 'du-12', du: 'DU-12', component: 'App platform', status: 'DIGEST-BOUND', note: 'API and worker image digests bound' },
  { id: 'du-13', du: 'DU-13', component: 'Private endpoints', status: 'PACKAGED', note: 'Private-link target candidate' },
  { id: 'du-14', du: 'DU-14', component: 'APIM lockdown', status: 'GATED', note: 'Private gateway proof required before closure' },
  { id: 'du-15', du: 'DU-15', component: 'Private ingress', status: 'OWNER INPUTS', note: 'Feature registration evidence required' },
  { id: 'du-16', du: 'DU-16', component: 'Internal Audit retention', status: 'SEPARATE AUTH', note: 'Internal Audit authority only' },
  { id: 'du-17', du: `DU-${String(17).padStart(2, '0')}`, component: 'Inventory closure', status: 'PACKAGED', note: 'Inventory capture step candidate' },
]

const deployPackageStatusClass = {
  PACKAGED: styles.deployPackageStatusPackaged,
  'DIGEST-BOUND': styles.deployPackageStatusDigest,
  GATED: styles.deployPackageStatusGated,
  'OWNER INPUTS': styles.deployPackageStatusOwner,
  'SEPARATE AUTH': styles.deployPackageStatusSeparate,
}

function DeployPackageRow({ unit, idPrefix, editable = false, loop = 'source', role }) {
  const statusClassName = `${styles.deployPackageStatus} ${deployPackageStatusClass[unit.status]}`

  return (
    <div className={styles.deployPackageRow} data-loop={loop} role={role}>
      <div className={styles.deployPackageMain}>
        {editable ? (
          <>
            <Editable as="span" id={`${idPrefix}.${unit.id}.du`} className={styles.deployPackageDu}>{unit.du}</Editable>
            <Editable as="strong" id={`${idPrefix}.${unit.id}.component`}>{unit.component}</Editable>
          </>
        ) : (
          <>
            <span className={styles.deployPackageDu}>{unit.du}</span>
            <strong>{unit.component}</strong>
          </>
        )}
      </div>
      {editable ? (
        <Editable as="span" id={`${idPrefix}.${unit.id}.status`} className={statusClassName}>{unit.status}</Editable>
      ) : (
        <span className={statusClassName}>{unit.status}</span>
      )}
      {editable ? (
        <Editable as="span" id={`${idPrefix}.${unit.id}.note`} className={styles.deployPackageNote}>{unit.note}</Editable>
      ) : (
        <span className={styles.deployPackageNote}>{unit.note}</span>
      )}
    </div>
  )
}

export default function DeploymentSlide({ index }) {
  return (
    <Slide index={index} className={`${styles.phaseSlide} ${styles.deploymentSlide} ${slideStyles.deploymentSlide}`}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      <div className={`${styles.body} content-frame content-gutter`}>
        <StrattonBrandMark />

        <header className={styles.header}>
          <Editable as="p" id="phase7-deploy.eyebrow" className={styles.eyebrow}>
            Optional Phase · Human invocation only · Not executed
          </Editable>
          <Editable as="h2" id="phase7-deploy.title" className={styles.title} multiline>
            Phase 7 - Deployment
          </Editable>
          <Editable as="p" id="phase7-deploy.subtitle" className={styles.subtitle} multiline>
            An authorised Azure deployment attempt follows the approved dependency sequence and returns immutable execution evidence.
          </Editable>
        </header>

        <section className={`${styles.surface} ${styles.deploymentSequencePanel}`}>
          <div className={styles.panelLead}>
            <div>
              <Editable as="p" id="phase7-deploy.sequence.kicker" className={styles.panelKicker}>Human-authorised execution corridor</Editable>
              <Editable as="h3" id="phase7-deploy.sequence.title">Six gates from approval to sealed evidence</Editable>
            </div>
            <span className={styles.dependencyBadge}>
              <GitBranch aria-hidden="true" strokeWidth={1.7} />
              <Editable as="span" id="phase7-deploy.sequence.order">{`${deployPackageUnits[0].du} → ${deployPackageUnits[deployPackageUnits.length - 1].du}`}</Editable>
            </span>
          </div>

          <EditableList
            id="phase7-deploy.steps"
            items={deploymentSteps}
            keyOf={(item) => item.id}
            className={styles.deploymentSteps}
            itemClassName={styles.deploymentStepShell}
          >
            {(item) => {
              const Icon = item.icon
              return (
                <div className={styles.deploymentStepWrap}>
                  <article
                    className={`${styles.deploymentStep} ${slideStyles.deploymentStepInteractive}`}
                    data-deployment-step={item.id}
                  >
                    <div className={styles.deploymentStepTop}>
                      <Editable as="span" id={`phase7-deploy.steps.${item.id}.number`}>{item.number}</Editable>
                      <Icon aria-hidden="true" strokeWidth={1.65} />
                    </div>
                    <Editable as="strong" id={`phase7-deploy.steps.${item.id}.title`}>{item.title}</Editable>
                    <Editable as="p" id={`phase7-deploy.steps.${item.id}.text`} multiline>{item.text}</Editable>
                    <Editable as="small" id={`phase7-deploy.steps.${item.id}.gate`}>{item.gate}</Editable>
                  </article>
                  {item.id !== 'evidence' && <ArrowRight aria-hidden="true" strokeWidth={1.55} />}
                </div>
              )
            }}
          </EditableList>
        </section>

        <div className={styles.deploymentBottom}>
          <section className={`${styles.surface} ${styles.deployControlCard} ${slideStyles.deployControlCard}`}>
            <span className={styles.deployControlIcon}><CircleStop aria-hidden="true" strokeWidth={1.7} /></span>
            <div>
              <Editable as="strong" id="phase7-deploy.stop.title">Stop conditions</Editable>
              <Editable as="p" id="phase7-deploy.stop.text" multiline>
                Hash drift, missing owner values, policy denial, failed what-if review, security findings or dependency failure end the attempt.
              </Editable>
            </div>
          </section>

          <section className={`${styles.surface} ${styles.deployControlCard} ${slideStyles.deployControlCard}`}>
            <span className={styles.deployControlIcon}><RotateCcw aria-hidden="true" strokeWidth={1.7} /></span>
            <div>
              <Editable as="strong" id="phase7-deploy.rollback.title">Rollback posture</Editable>
              <Editable as="p" id="phase7-deploy.rollback.text" multiline>
                Roll back only the approved stage boundary; preserve logs, resource state and the human go/no-go decision.
              </Editable>
            </div>
          </section>

          <section className={`${styles.surface} ${styles.deployEvidenceCard}`} tabIndex={0}>
            <div className={styles.deployEvidenceHeading}>
              <span className={styles.deployEvidenceIcons} aria-hidden="true">
                <img src={managementGroupsIcon} alt="" />
                <img src={policyIcon} alt="" />
                <img src={monitorIcon} alt="" />
              </span>
              <Editable as="strong" id="phase7-deploy.package.title">Deployable package stream</Editable>
              <span className={styles.deployEvidenceMeta}>
                <Editable as="span" id="phase7-deploy.package.caption" className={styles.deployEvidenceCaption}>Local Phase 5 evidence · Azure deployment not executed</Editable>
                <Editable as="small" id="phase7-deploy.package.future" className={styles.deployEvidenceFuture}>An authorised Phase 7 run appends deployment IDs, policy state and before/after inventory after human authorisation.</Editable>
              </span>
            </div>

            <div className={styles.deployPackageViewport}>
              <div className={styles.deployPackageTrack}>
                <div className={styles.deployPackageSourceGroup} role="list" aria-label="Deployable package units">
                  {deployPackageUnits.map((unit) => (
                    <DeployPackageRow key={`source-${unit.id}`} unit={unit} idPrefix="phase7-deploy.package.source" editable role="listitem" />
                  ))}
                </div>
                <div className={styles.deployPackageCloneGroup} aria-hidden="true">
                  {deployPackageUnits.map((unit) => (
                    <DeployPackageRow key={`clone-${unit.id}`} unit={unit} idPrefix="phase7-deploy.package.clone" loop="clone" />
                  ))}
                </div>
              </div>
              <Editable as="p" id="phase7-deploy.package.static-note" className={styles.deployPackageStaticNote}>
                {'Full package contains DU-01 -> DU-17; Azure deployment not executed.'}
              </Editable>
            </div>
          </section>
        </div>
      </div>

      <PresentationStatus index={index} />
      <BottomBar text={<Editable as="span" id="phase7-deploy.footer">Stratton Europe Capital · Optional Phase 7 deployment runbook · Azure deployment not executed</Editable>} />
    </Slide>
  )
}
