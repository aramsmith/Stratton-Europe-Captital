import { Caption1, makeStyles, shorthands, tokens } from "@fluentui/react-components";
import type { EvidenceItem } from "@stratton/contracts";

const useStyles = makeStyles({
  panel: {
    display: "grid",
    gap: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusLarge)
  }
});

interface CitationPanelProps {
  readonly citation?: {
    citationId: string;
    evidenceId: string;
    locator: string;
    accessible: true;
  } | undefined;
  readonly evidence?: EvidenceItem | undefined;
}

export function CitationPanel({ citation, evidence }: CitationPanelProps) {
  const styles = useStyles();

  return (
    <section aria-labelledby="citation-panel-heading" className={styles.panel}>
      <h3 id="citation-panel-heading">Citation detail</h3>
      {citation && evidence ? (
        <>
          <strong>{evidence.title}</strong>
          <Caption1>{citation.locator}</Caption1>
          <Caption1>{evidence.sourceLocator}</Caption1>
          {evidence.sourcePreview ? <p>{evidence.sourcePreview}</p> : null}
        </>
      ) : (
        <Caption1>Select a citation to open the exact source locator.</Caption1>
      )}
    </section>
  );
}
