import {
  Body1,
  Button,
  Card,
  Caption1,
  Spinner,
  Tab,
  TabList,
  Title3,
  makeStyles,
  shorthands,
  tokens
} from "@fluentui/react-components";
import type {
  GovernanceView,
  ScenarioState,
  SecurityGateRunRequest
} from "@stratton/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DemoClient } from "../api/demoClient.js";
import { AuditExportPanel } from "./AuditExportPanel.js";
import { LineageGraph } from "./LineageGraph.js";
import { ModelRoutePanel } from "./ModelRoutePanel.js";
import { PolicyDecisionTable } from "./PolicyDecisionTable.js";
import { SecurityGateMatrix } from "./SecurityGateMatrix.js";

type GovernanceTab = "lineage" | "policy" | "routes" | "security";

interface GovernanceConsolePageProps {
  readonly scenario: ScenarioState;
  readonly loadGovernanceView?: ((signal?: AbortSignal) => Promise<GovernanceView>) | undefined;
  readonly onRunSecurityGateSuite?: (
    (input: SecurityGateRunRequest) => Promise<void> | void
  ) | undefined;
}

const useStyles = makeStyles({
  layout: {
    display: "grid",
    gap: tokens.spacingVerticalXL
  },
  card: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL)
  },
  panel: {
    display: "grid",
    gap: tokens.spacingVerticalL
  },
  grid: {
    display: "grid",
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: "minmax(0, 1fr)"
  }
});

export function GovernanceConsolePage({
  scenario,
  loadGovernanceView,
  onRunSecurityGateSuite
}: GovernanceConsolePageProps) {
  const styles = useStyles();
  const client = useMemo(() => new DemoClient(), []);
  const [selectedTab, setSelectedTab] = useState<GovernanceTab>("lineage");
  const [view, setView] = useState<GovernanceView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gateRunError, setGateRunError] = useState<string | null>(null);
  const [isGateRunPending, setIsGateRunPending] = useState(false);

  const refreshKey = [
    scenario.stage,
    scenario.findings.length,
    scenario.reviews.length,
    scenario.governanceEvents.length,
    scenario.latestAnalysisRun?.analysisRequestFingerprint ?? "no-analysis"
  ].join(":");
  const loadView = useCallback(
    (signal?: AbortSignal) => (loadGovernanceView ?? ((innerSignal?: AbortSignal) => client.getGovernanceView(innerSignal)))(signal),
    [client, loadGovernanceView]
  );

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    void loadView(controller.signal)
      .then((nextView) => {
        if (!controller.signal.aborted) {
          setView(nextView);
        }
      })
      .catch((caughtError: unknown) => {
        if (!controller.signal.aborted) {
          setView(null);
          setError(toErrorMessage(caughtError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [loadView, refreshKey]);

  const runSecurityGateSuite = async () => {
    if (!onRunSecurityGateSuite) {
      return;
    }
    setGateRunError(null);
    setIsGateRunPending(true);
    try {
      await onRunSecurityGateSuite({ caseId: scenario.caseId });
    } catch (caughtError) {
      setGateRunError(toErrorMessage(caughtError));
    } finally {
      setIsGateRunPending(false);
    }
  };

  return (
    <div className={styles.layout}>
      <section aria-labelledby="governance-console-heading">
        <Title3 as="h2" id="governance-console-heading">
          Governance & Assurance Console
        </Title3>
        <Body1>
          Trace source-to-recommendation lineage, expose policy and route evidence, and preview
          audit export readiness without issuing an Internal Audit verdict.
        </Body1>
      </section>

      <Card className={styles.card}>
        <Body1>Internal Audit verdict: Not issued</Body1>
        <Body1>
          The console stays read-only. It shows lineage, route evidence, and export readiness only.
        </Body1>
      </Card>

      {error ? (
        <Card className={styles.card} role="alert">
          <Body1>{error}</Body1>
          <Body1>
            Governance evidence is hidden until the approved read model can be loaded again.
          </Body1>
        </Card>
      ) : null}

      {isLoading && !view ? (
        <Card className={styles.card}>
          <Spinner label="Loading governance evidence..." labelPosition="below" />
        </Card>
      ) : null}

      {!error && view ? (
        <div className={styles.grid}>
          <TabList
            aria-label="Governance console tabs"
            selectedValue={selectedTab}
            onTabSelect={(_event, data) => setSelectedTab(data.value as GovernanceTab)}
          >
            <Tab id="governance-tab-lineage" value="lineage">
              Lineage
            </Tab>
            <Tab id="governance-tab-policy" value="policy">
              Policy decisions
            </Tab>
            <Tab id="governance-tab-routes" value="routes">
              Model routes
            </Tab>
            <Tab id="governance-tab-security" value="security">
              Security & audit
            </Tab>
          </TabList>

          {selectedTab === "lineage" ? (
            <section
              aria-labelledby="governance-tab-lineage"
              className={styles.panel}
              role="tabpanel"
            >
              <LineageGraph lineage={view.lineage} />
            </section>
          ) : null}

          {selectedTab === "policy" ? (
            <section
              aria-labelledby="governance-tab-policy"
              className={styles.panel}
              role="tabpanel"
            >
              <PolicyDecisionTable policyDecisions={view.policyDecisions} />
            </section>
          ) : null}

          {selectedTab === "routes" ? (
            <section
              aria-labelledby="governance-tab-routes"
              className={styles.panel}
              role="tabpanel"
            >
              <ModelRoutePanel modelRoutes={view.modelRoutes} />
            </section>
          ) : null}

          {selectedTab === "security" ? (
            <section
              aria-labelledby="governance-tab-security"
              className={styles.panel}
              role="tabpanel"
            >
              <Card className={styles.card}>
                <Body1>
                  Run the deterministic Project Danube security checks to create dedicated,
                  version-bound evidence for all twelve mandatory gates.
                </Body1>
                <Button
                  appearance="primary"
                  disabled={!onRunSecurityGateSuite || isGateRunPending}
                  onClick={() => void runSecurityGateSuite()}
                >
                  {isGateRunPending ? "Running security gate checks..." : "Run security gate checks"}
                </Button>
                {gateRunError ? (
                  <Caption1 role="alert">{gateRunError}</Caption1>
                ) : null}
              </Card>
              <SecurityGateMatrix securityGates={view.securityGates} />
              <AuditExportPanel auditExport={view.auditExport} />
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function toErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "Governance evidence could not be loaded.";
}
