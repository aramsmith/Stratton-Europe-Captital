import {
  Badge,
  Body1,
  Body1Strong,
  Breadcrumb,
  BreadcrumbButton,
  BreadcrumbDivider,
  BreadcrumbItem,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Text,
  Title2,
  makeStyles,
  shorthands,
  tokens
} from "@fluentui/react-components";
import type { ScenarioState } from "@stratton/contracts";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { workspaceDefinitions } from "../app/routes.js";

interface StrattonShellProps {
  readonly scenario: ScenarioState;
  readonly children: ReactNode;
  readonly onReset?: () => Promise<void> | void;
  readonly isResetPending?: boolean;
  readonly resetError?: string | null;
}

const useStyles = makeStyles({
  viewport: {
    display: "grid",
    gridTemplateColumns: "276px minmax(0, 1fr)",
    minHeight: "100vh",
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
    "@media (max-width: 900px)": {
      gridTemplateColumns: "1fr",
      gridTemplateRows: "auto 1fr"
    }
  },
  skipLink: {
    position: "fixed",
    left: tokens.spacingHorizontalM,
    top: tokens.spacingVerticalM,
    transform: "translateY(-200%)",
    zIndex: 20,
    backgroundColor: "#ffffff",
    color: "#0b223b",
    textDecorationLine: "none",
    boxShadow: tokens.shadow8,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ":focus-visible": {
      transform: "translateY(0)"
    }
  },
  rail: {
    position: "sticky",
    top: 0,
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    height: "100vh",
    color: "#f6f3eb",
    backgroundColor: "#081a2d",
    borderRight: "1px solid #314358",
    overflow: "hidden",
    "@media (max-width: 900px)": {
      position: "relative",
      height: "auto",
      gridTemplateRows: "auto auto",
      borderRight: "none",
      borderBottom: "1px solid #314358"
    }
  },
  railBrand: {
    display: "grid",
    gridTemplateColumns: "58px minmax(0, 1fr)",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    borderBottom: "1px solid rgba(199, 178, 125, 0.28)",
    ...shorthands.padding("24px", "22px")
  },
  sealFrame: {
    width: "58px",
    height: "58px",
    overflow: "hidden",
    backgroundColor: "#d9d6cf",
    border: "1px solid #a88740",
    ...shorthands.borderRadius("50%")
  },
  seal: {
    width: "100%",
    height: "100%",
    objectFit: "cover"
  },
  brandName: {
    display: "grid",
    alignItems: "center"
  },
  wordmark: {
    display: "block",
    width: "162px",
    maxWidth: "100%",
    height: "auto"
  },
  railBody: {
    display: "grid",
    alignContent: "start",
    gap: tokens.spacingVerticalL,
    minHeight: 0,
    overflowY: "auto",
    ...shorthands.padding("28px", "16px"),
    "@media (max-width: 900px)": {
      gap: tokens.spacingVerticalM,
      overflow: "visible",
      ...shorthands.padding("12px", "16px", "18px")
    }
  },
  railSectionLabel: {
    color: "#9faab5",
    fontSize: "11px",
    fontWeight: 650,
    letterSpacing: "0.13em",
    textTransform: "uppercase",
    ...shorthands.padding(0, "10px")
  },
  navigation: {
    display: "grid",
    gap: "4px",
    "@media (max-width: 900px)": {
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))"
    },
    "@media (max-width: 620px)": {
      gridTemplateColumns: "1fr"
    }
  },
  navLink: {
    display: "grid",
    gap: "4px",
    minHeight: "62px",
    color: "#c9d0d7",
    textDecorationLine: "none",
    border: "1px solid transparent",
    ...shorthands.padding("13px", "14px"),
    ...shorthands.borderRadius("4px"),
    ":hover": {
      color: "#ffffff",
      backgroundColor: "#102a45"
    },
    ":focus-visible": {
      outline: "2px solid #c7b27d",
      outlineOffset: "2px"
    }
  },
  navLinkCurrent: {
    color: "#ffffff",
    backgroundColor: "#112f4d",
    ...shorthands.borderColor("#52657a"),
    boxShadow: "inset 3px 0 0 #b28c3d"
  },
  navTitle: {
    fontSize: "14px",
    fontWeight: 650,
    lineHeight: 1.25
  },
  navSummary: {
    color: "#97a4b1",
    fontSize: "11px",
    lineHeight: 1.35,
    "@media (max-width: 900px)": {
      display: "none"
    }
  },
  railFooter: {
    display: "grid",
    gap: tokens.spacingVerticalS,
    color: "#aeb7c0",
    borderTop: "1px solid rgba(199, 178, 125, 0.22)",
    ...shorthands.padding("18px", "22px", "22px"),
    "@media (max-width: 900px)": {
      display: "none"
    }
  },
  railCaseId: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: "11px",
    letterSpacing: "0.04em"
  },
  resetError: {
    color: "#ffb3ad"
  },
  workspace: {
    display: "grid",
    gridTemplateRows: "auto 1fr",
    minWidth: 0,
    minHeight: "100vh"
  },
  commandBar: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    display: "grid",
    gap: tokens.spacingVerticalS,
    backgroundColor: "rgba(255, 255, 255, 0.97)",
    borderBottom: "1px solid #d3d0c7",
    boxShadow: "0 2px 10px rgba(13, 31, 49, 0.05)",
    ...shorthands.padding("13px", "28px", "11px"),
    "@media (max-width: 700px)": {
      ...shorthands.padding("12px", "18px")
    }
  },
  commandRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacingHorizontalL,
    minWidth: 0
  },
  commandContext: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    minWidth: 0
  },
  mandate: {
    display: "grid",
    gap: "1px",
    minWidth: 0
  },
  mandateTitle: {
    fontWeight: 650
  },
  mandateDetail: {
    color: tokens.colorNeutralForeground3
  },
  account: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS
  },
  avatar: {
    display: "grid",
    placeItems: "center",
    width: "36px",
    height: "36px",
    color: "#ffffff",
    backgroundColor: "#0b223b",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.05em",
    ...shorthands.borderRadius("50%")
  },
  accountText: {
    display: "grid",
    gap: "1px",
    "@media (max-width: 620px)": {
      display: "none"
    }
  },
  breadcrumb: {
    color: tokens.colorNeutralForeground3
  },
  main: {
    minWidth: 0,
    ...shorthands.padding("28px", "32px", "48px"),
    "@media (max-width: 700px)": {
      ...shorthands.padding("20px", "16px", "36px")
    }
  },
  mainLayout: {
    display: "grid",
    gap: "24px",
    width: "min(1540px, 100%)",
    margin: "0 auto"
  },
  caseLedger: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(480px, 0.8fr)",
    minHeight: "154px",
    backgroundColor: "#ffffff",
    borderTop: "3px solid #9a7932",
    boxShadow: "0 8px 22px rgba(13, 31, 49, 0.08)",
    ...shorthands.borderRadius("8px"),
    "@media (max-width: 1050px)": {
      gridTemplateColumns: "1fr"
    }
  },
  caseIdentity: {
    display: "grid",
    alignContent: "center",
    gap: tokens.spacingVerticalS,
    ...shorthands.padding("26px", "28px")
  },
  caseTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    flexWrap: "wrap"
  },
  caseTitle: {
    margin: 0,
    color: "#0b223b",
    fontFamily: '"Source Serif 4", Georgia, serif',
    fontWeight: 600,
    letterSpacing: "-0.02em"
  },
  caseDescription: {
    maxWidth: "72ch",
    color: tokens.colorNeutralForeground2
  },
  ledgerMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    backgroundColor: "#f5f3ee",
    borderLeft: "1px solid #dedbd2",
    "@media (max-width: 1050px)": {
      borderLeft: "none",
      borderTop: "1px solid #dedbd2"
    },
    "@media (max-width: 620px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
    }
  },
  ledgerMetric: {
    display: "grid",
    alignContent: "center",
    gap: "5px",
    minHeight: "92px",
    borderRight: "1px solid #dedbd2",
    ...shorthands.padding("18px", "16px"),
    ":last-child": {
      borderRight: "none"
    }
  },
  metricValue: {
    color: "#0b223b",
    fontSize: "24px",
    fontWeight: 650,
    lineHeight: 1
  },
  metricLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: "11px",
    fontWeight: 650,
    letterSpacing: "0.08em",
    textTransform: "uppercase"
  },
  routeContainer: {
    display: "grid",
    gap: tokens.spacingVerticalL
  },
  dialogBody: {
    display: "grid",
    gap: tokens.spacingVerticalM
  }
});

export function StrattonShell({
  scenario,
  children,
  onReset,
  isResetPending = false,
  resetError
}: StrattonShellProps) {
  const styles = useStyles();
  const location = useLocation();
  const navigate = useNavigate();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const selectedPath = workspaceDefinitions.some((workspace) => workspace.path === location.pathname)
    ? location.pathname
    : "/workbench";
  const currentWorkspace =
    workspaceDefinitions.find((workspace) => workspace.path === selectedPath) ??
    workspaceDefinitions[0];

  const openResetDialog = useCallback(() => {
    if (onReset) {
      setIsResetDialogOpen(true);
    }
  }, [onReset]);

  const closeResetDialog = useCallback(() => {
    if (!isResetPending) {
      setIsResetDialogOpen(false);
    }
  }, [isResetPending]);

  const handleConfirmReset = useCallback(async () => {
    if (!onReset) {
      return;
    }

    await onReset();
    setIsResetDialogOpen(false);
  }, [onReset]);

  const metrics = [
    { label: "Evidence", value: scenario.evidence.length },
    { label: "Findings", value: scenario.findings.length },
    { label: "Reviews", value: scenario.reviews.length },
    { label: "Audit events", value: scenario.governanceEvents.length }
  ] as const;

  return (
    <div className={styles.viewport}>
      <a className={styles.skipLink} href="#route-content">
        Skip to main content
      </a>

      <aside className={styles.rail}>
        <header className={styles.railBrand}>
          <div className={styles.sealFrame}>
            <img alt="" className={styles.seal} src="/stratton-emblem.png" />
          </div>
          <div className={styles.brandName}>
            <img
              alt="Stratton Europe Capital"
              className={styles.wordmark}
              src="/stratton-wordmark.png"
            />
          </div>
        </header>

        <div className={styles.railBody}>
          <Text className={styles.railSectionLabel}>Investment workflow</Text>
          <nav aria-label="Stratton demo workspaces" className={styles.navigation}>
            {workspaceDefinitions.map((workspace) => {
              const isCurrent = workspace.path === selectedPath;
              const className = isCurrent
                ? `${styles.navLink} ${styles.navLinkCurrent}`
                : styles.navLink;

              return (
                <a
                  key={workspace.path}
                  aria-current={isCurrent ? "page" : undefined}
                  aria-label={workspace.label}
                  className={className}
                  href={workspace.path}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(workspace.path);
                  }}
                >
                  <span className={styles.navTitle}>{workspace.label}</span>
                  <span className={styles.navSummary}>{workspace.summary}</span>
                </a>
              );
            })}
          </nav>
        </div>

        <footer className={styles.railFooter}>
          <Body1Strong>Project Danube</Body1Strong>
          <Caption1 className={styles.railCaseId}>CASE / {scenario.caseId.toUpperCase()}</Caption1>
          <Caption1>Investing in Europe’s Future</Caption1>
          {resetError ? (
            <Caption1 className={styles.resetError} role="alert">
              {resetError}
            </Caption1>
          ) : null}
        </footer>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.commandBar}>
          <div className={styles.commandRow}>
            <div className={styles.commandContext}>
              <div className={styles.mandate}>
                <Body1Strong className={styles.mandateTitle}>
                  Project Danube investment mandate
                </Body1Strong>
                <Caption1 className={styles.mandateDetail}>
                  Private equity opportunity · governed committee preparation
                </Caption1>
              </div>
            </div>

            <div className={styles.account}>
              <Button
                aria-label="Reset Project Danube"
                appearance="subtle"
                disabled={isResetPending || !onReset}
                onClick={openResetDialog}
              >
                {isResetPending ? "Resetting..." : "Reset case"}
              </Button>
              <div className={styles.avatar} aria-hidden="true">
                EM
              </div>
              <div className={styles.accountText}>
                <Body1Strong>Elena Müller</Body1Strong>
                <Caption1>Deal Lead</Caption1>
              </div>
            </div>
          </div>

          <Breadcrumb aria-label="Current workspace breadcrumb" className={styles.breadcrumb}>
            <BreadcrumbItem>
              <Text>Mandates</Text>
            </BreadcrumbItem>
            <BreadcrumbDivider />
            <BreadcrumbItem>
              <Text>Project Danube</Text>
            </BreadcrumbItem>
            <BreadcrumbDivider />
            <BreadcrumbItem>
              <BreadcrumbButton current>{currentWorkspace.label}</BreadcrumbButton>
            </BreadcrumbItem>
          </Breadcrumb>
        </header>

        <Dialog modalType="modal" open={isResetDialogOpen}>
          <DialogSurface aria-describedby="reset-project-danube-description">
            <DialogBody className={styles.dialogBody}>
              <DialogTitle>Reset Project Danube</DialogTitle>
              <DialogContent id="reset-project-danube-description">
                Reset Project Danube to the approved baseline? This will discard the current demo
                session state.
              </DialogContent>
              <DialogActions>
                <Button
                  appearance="primary"
                  disabled={isResetPending}
                  onClick={() => void handleConfirmReset()}
                >
                  {isResetPending ? "Resetting..." : "Confirm reset"}
                </Button>
                <Button appearance="secondary" disabled={isResetPending} onClick={closeResetDialog}>
                  Cancel
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>

        <main className={styles.main} id="route-content" tabIndex={-1}>
          <div className={styles.mainLayout}>
            <section className={styles.caseLedger} aria-labelledby="case-title">
              <div className={styles.caseIdentity}>
                <div className={styles.caseTitleRow}>
                  <Title2 as="h1" className={styles.caseTitle} id="case-title">
                    Project Danube
                  </Title2>
                  <Badge appearance="filled" color="informative">
                    {scenario.stage}
                  </Badge>
                </div>
                <Body1 className={styles.caseDescription}>{currentWorkspace.summary}</Body1>
              </div>

              <div className={styles.ledgerMetrics} aria-label="Case summary">
                {metrics.map((metric) => (
                  <div className={styles.ledgerMetric} key={metric.label}>
                    <Text className={styles.metricValue}>{metric.value}</Text>
                    <Text className={styles.metricLabel}>{metric.label}</Text>
                  </div>
                ))}
              </div>
            </section>

            <div className={styles.routeContainer}>{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
