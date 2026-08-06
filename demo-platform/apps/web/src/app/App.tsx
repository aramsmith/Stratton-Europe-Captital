import {
  Body1,
  Button,
  FluentProvider,
  Spinner,
  Title3,
  makeStyles,
  shorthands,
  tokens,
  webLightTheme
} from "@fluentui/react-components";
import type { ScenarioState } from "@stratton/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { DemoClient } from "../api/demoClient.js";
import { StrattonShell } from "../shell/StrattonShell.js";
import { AppRoutes } from "./routes.js";

const useStyles = makeStyles({
  fullScreen: {
    display: "grid",
    placeItems: "center",
    minHeight: "100vh",
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalXL)
  },
  stateCard: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    maxWidth: "480px",
    textAlign: "center",
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow8,
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalXL),
    ...shorthands.borderRadius(tokens.borderRadiusLarge)
  }
});

export function App() {
  const styles = useStyles();
  const client = useMemo(() => new DemoClient(), []);
  const [scenario, setScenario] = useState<ScenarioState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isResetPending, setIsResetPending] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const loadScenario = useCallback(
    async (signal?: AbortSignal) => {
      setLoadError(null);

      try {
        const nextScenario = await client.getScenario(signal);
        setScenario(nextScenario);
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }

        setLoadError(toErrorMessage(error));
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [client]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadScenario(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadScenario]);

  const handleRetry = useCallback(() => {
    setScenario(null);
    setIsLoading(true);
    void loadScenario();
  }, [loadScenario]);

  const handleReset = useCallback(async () => {
    setResetError(null);
    setIsResetPending(true);

    try {
      const nextScenario = await client.resetScenario();
      setScenario(nextScenario);
    } catch (error) {
      setResetError(toErrorMessage(error));
    } finally {
      setIsResetPending(false);
    }
  }, [client]);

  return (
    <FluentProvider theme={webLightTheme}>
      <title>Stratton demo platform</title>

      {isLoading && !scenario ? (
        <div className={styles.fullScreen}>
          <div className={styles.stateCard}>
            <Spinner label="Loading Project Danube..." labelPosition="below" size="huge" />
          </div>
        </div>
      ) : null}

      {!isLoading && !scenario ? (
        <div className={styles.fullScreen}>
          <div className={styles.stateCard} role="alert">
            <Title3>Unable to load Project Danube</Title3>
            <Body1>{loadError ?? "The approved scenario could not be loaded."}</Body1>
            <Button appearance="primary" onClick={handleRetry}>
              Retry loading scenario
            </Button>
          </div>
        </div>
      ) : null}

      {scenario ? (
        <BrowserRouter>
          <StrattonShell
            isResetPending={isResetPending}
            onReset={handleReset}
            resetError={resetError}
            scenario={scenario}
          >
            <AppRoutes scenario={scenario} />
          </StrattonShell>
        </BrowserRouter>
      ) : null}
    </FluentProvider>
  );
}

function toErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "The approved scenario could not be loaded.";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
