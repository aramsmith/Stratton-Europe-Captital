import {
  Badge,
  Body1,
  Breadcrumb,
  BreadcrumbButton,
  BreadcrumbDivider,
  BreadcrumbItem,
  Caption1,
  NavDrawer,
  NavDrawerBody,
  NavDrawerFooter,
  NavDrawerHeader,
  NavItem,
  Persona,
  Text,
  Title2,
  Toolbar,
  ToolbarButton,
  makeStyles,
  shorthands,
  tokens
} from "@fluentui/react-components";
import type { ScenarioState } from "@stratton/contracts";
import type { ReactNode } from "react";
import { useCallback } from "react";
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
    gridTemplateRows: "auto 1fr",
    height: "100vh",
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
    overflow: "hidden"
  },
  skipLink: {
    position: "absolute",
    left: tokens.spacingHorizontalM,
    top: tokens.spacingVerticalM,
    transform: "translateY(-200%)",
    zIndex: 1,
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    textDecorationLine: "none",
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ":focus-visible": {
      transform: "translateY(0)"
    }
  },
  topBar: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL)
  },
  topBarRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacingHorizontalL,
    flexWrap: "wrap"
  },
  brandBlock: {
    display: "grid",
    gap: tokens.spacingVerticalXXS
  },
  topBarMeta: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    flexWrap: "wrap"
  },
  shellBody: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    minHeight: 0,
    overflow: "hidden"
  },
  drawer: {
    minHeight: 0,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow2
  },
  drawerHeader: {
    display: "grid",
    gap: tokens.spacingVerticalXS,
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL)
  },
  drawerBody: {
    display: "grid",
    alignContent: "start",
    gap: tokens.spacingVerticalXS,
    ...shorthands.padding(0, tokens.spacingHorizontalS, tokens.spacingVerticalS)
  },
  drawerFooter: {
    display: "grid",
    gap: tokens.spacingVerticalS,
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL)
  },
  main: {
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalXL)
  },
  mainLayout: {
    display: "grid",
    gap: tokens.spacingVerticalXL,
    minHeight: "100%"
  },
  casePanel: {
    display: "grid",
    gap: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow8,
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalXL),
    ...shorthands.borderRadius(tokens.borderRadiusLarge)
  },
  caseHeader: {
    display: "grid",
    gap: tokens.spacingVerticalXS
  },
  caseFacts: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
    alignItems: "center"
  },
  routeContainer: {
    display: "grid",
    gap: tokens.spacingVerticalL
  },
  resetError: {
    color: tokens.colorPaletteRedForeground1
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
  const selectedPath = workspaceDefinitions.some((workspace) => workspace.path === location.pathname)
    ? location.pathname
    : "/workbench";
  const currentWorkspace =
    workspaceDefinitions.find((workspace) => workspace.path === selectedPath) ?? workspaceDefinitions[0];

  const handleReset = useCallback(async () => {
    if (!onReset) {
      return;
    }

    const confirmed = window.confirm(
      "Reset Project Danube to the approved baseline? This will discard the current demo session state."
    );

    if (!confirmed) {
      return;
    }

    await onReset();
  }, [onReset]);

  return (
    <div className={styles.viewport}>
      <a className={styles.skipLink} href="#route-content">
        Skip to main content
      </a>

      <header className={styles.topBar}>
        <div className={styles.topBarRow}>
          <div className={styles.brandBlock}>
            <Body1>Stratton Europe Capital</Body1>
            <Caption1>Dynamics-style shell with Fluent 2 workspaces</Caption1>
          </div>

          <div className={styles.topBarMeta}>
            <Toolbar aria-label="Scenario actions">
              <ToolbarButton disabled={isResetPending} onClick={() => void handleReset()}>
                {isResetPending ? "Resetting..." : "Reset demo scenario"}
              </ToolbarButton>
            </Toolbar>

            <Persona
              name="Elena Müller"
              secondaryText="Deal Lead"
              tertiaryText="Project Danube"
              size="large"
            />
          </div>
        </div>

        <Breadcrumb aria-label="Current workspace breadcrumb">
          <BreadcrumbItem>
            <BreadcrumbButton>Stratton demos</BreadcrumbButton>
          </BreadcrumbItem>
          <BreadcrumbDivider />
          <BreadcrumbItem>
            <BreadcrumbButton>Project Danube</BreadcrumbButton>
          </BreadcrumbItem>
          <BreadcrumbDivider />
          <BreadcrumbItem>
            <BreadcrumbButton current>{currentWorkspace.label}</BreadcrumbButton>
          </BreadcrumbItem>
        </Breadcrumb>
      </header>

      <div className={styles.shellBody}>
        <NavDrawer aria-label="Stratton demo workspaces" className={styles.drawer} open type="inline" selectedValue={selectedPath}>
          <NavDrawerHeader className={styles.drawerHeader}>
            <Text size={400}>Approved workspaces</Text>
            <Caption1>Project Danube follows the approved evidence-to-decision journey.</Caption1>
          </NavDrawerHeader>

          <NavDrawerBody className={styles.drawerBody}>
            {workspaceDefinitions.map((workspace) => {
              const isCurrent = workspace.path === selectedPath;

              return (
                <NavItem
                  key={workspace.path}
                  aria-current={isCurrent ? "page" : undefined}
                  href={workspace.path}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(workspace.path);
                  }}
                  value={workspace.path}
                >
                  {workspace.label}
                </NavItem>
              );
            })}
          </NavDrawerBody>

          <NavDrawerFooter className={styles.drawerFooter}>
            <Caption1>Case ID: {scenario.caseId}</Caption1>
            {resetError ? (
              <Caption1 className={styles.resetError} role="alert">
                {resetError}
              </Caption1>
            ) : null}
          </NavDrawerFooter>
        </NavDrawer>

        <main className={styles.main} id="route-content" tabIndex={-1}>
          <div className={styles.mainLayout}>
            <section className={styles.casePanel} aria-labelledby="case-title">
              <header className={styles.caseHeader}>
                <Text size={200}>PRIVATE EQUITY OPPORTUNITY</Text>
                <Title2 as="h1" id="case-title">Project Danube</Title2>
                <Badge appearance="filled" color="informative">
                  {scenario.stage}
                </Badge>
              </header>

              <div className={styles.caseFacts}>
                <Badge appearance="tint" color="brand">
                  {scenario.evidence.length} evidence items
                </Badge>
                <Badge appearance="tint" color="important">
                  {scenario.findings.length} findings
                </Badge>
                <Badge appearance="tint" color="warning">
                  {scenario.reviews.length} reviews
                </Badge>
                <Badge appearance="tint" color="success">
                  {scenario.governanceEvents.length} audit events
                </Badge>
              </div>
            </section>

            <div className={styles.routeContainer}>{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
