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
import type {
  AnalysisRunRequest,
  AnalysisRunResponse,
  EvidenceAdmissionRequest,
  FindingDispositionRequest,
  RecommendationPreparationRequest,
  ReviewSubmissionRequest,
  SecurityGateRunRequest,
  ScenarioState
} from "@stratton/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { DemoClient } from "../api/demoClient.js";
import {
  createLocalBrowserAuthSession,
  type BrowserAuthAccount,
  type BrowserAuthSession
} from "../auth/browserAuth.js";
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

interface AppProps {
  readonly authSession?: BrowserAuthSession;
}

export function App({ authSession = createLocalBrowserAuthSession() }: AppProps) {
  const styles = useStyles();
  const [account, setAccount] = useState<BrowserAuthAccount | null>(authSession.account);
  const [isSignInPending, setIsSignInPending] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const client = useMemo(
    () => new DemoClient("/api", () => authSession.getAccessToken()),
    [authSession]
  );
  const [scenario, setScenario] = useState<ScenarioState | null>(null);
  const [isLoading, setIsLoading] = useState(account !== null);
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
  const loadGovernanceView = useCallback(
    (signal?: AbortSignal) => client.getGovernanceView(signal),
    [client]
  );

  useEffect(() => {
    if (!account) {
      return;
    }
    const controller = new AbortController();
    void loadScenario(controller.signal);

    return () => {
      controller.abort();
    };
  }, [account, loadScenario]);

  const handleSignIn = useCallback(async () => {
    setSignInError(null);
    setIsSignInPending(true);
    try {
      await authSession.signIn();
      setAccount(authSession.account);
      setIsLoading(authSession.account !== null);
    } catch (error) {
      setSignInError(toErrorMessage(error));
    } finally {
      setIsSignInPending(false);
    }
  }, [authSession]);

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

  const handleAdmitEvidence = useCallback(
    async (input: EvidenceAdmissionRequest & { evidenceId: string }) => {
      const nextScenario = await client.admitEvidence(input);
      setScenario(nextScenario);
    },
    [client]
  );

  const handleRunAnalysis = useCallback(
    async (input: AnalysisRunRequest): Promise<AnalysisRunResponse> => {
      const result = await client.runAnalysis(input);
      setScenario(result.scenario);
      return result;
    },
    [client]
  );

  const handleRecordDisposition = useCallback(
    async (input: FindingDispositionRequest & { findingId: string }) => {
      const nextScenario = await client.recordFindingDisposition(input);
      setScenario(nextScenario);
    },
    [client]
  );

  const handleSubmitReview = useCallback(
    async (input: ReviewSubmissionRequest & { findingId: string }) => {
      const nextScenario = await client.submitReview(input);
      setScenario(nextScenario);
    },
    [client]
  );

  const handlePrepareRecommendation = useCallback(
    async (input: RecommendationPreparationRequest) => {
      const nextScenario = await client.prepareRecommendation(input);
      setScenario(nextScenario);
    },
    [client]
  );

  const handleRunSecurityGateSuite = useCallback(
    async (input: SecurityGateRunRequest) => {
      const nextScenario = await client.runSecurityGateSuite(input);
      setScenario(nextScenario);
    },
    [client]
  );

  return (
    <FluentProvider theme={webLightTheme}>
      <title>Stratton demo platform</title>

      {!account ? (
        <div className={styles.fullScreen}>
          <div className={styles.stateCard}>
            <Title3>Sign in to Stratton demo platform</Title3>
            <Body1>
              Use your approved Microsoft Entra account to access Project Danube.
            </Body1>
            <Button
              appearance="primary"
              disabled={isSignInPending}
              onClick={() => void handleSignIn()}
            >
              {isSignInPending ? "Signing in..." : "Sign in with Microsoft"}
            </Button>
            {signInError ? <Body1 role="alert">{signInError}</Body1> : null}
          </div>
        </div>
      ) : null}

      {account && isLoading && !scenario ? (
        <div className={styles.fullScreen}>
          <div className={styles.stateCard}>
            <Spinner label="Loading Project Danube..." labelPosition="below" size="huge" />
          </div>
        </div>
      ) : null}

      {account && !isLoading && !scenario ? (
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
            <AppRoutes
              loadGovernanceView={loadGovernanceView}
              onPrepareRecommendation={handlePrepareRecommendation}
              scenario={scenario}
              onAdmitEvidence={handleAdmitEvidence}
              onRecordDisposition={handleRecordDisposition}
              onRunAnalysis={handleRunAnalysis}
              onRunSecurityGateSuite={handleRunSecurityGateSuite}
              onSubmitReview={handleSubmitReview}
            />
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
