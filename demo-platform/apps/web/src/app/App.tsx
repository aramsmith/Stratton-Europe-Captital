import {
  Body1,
  Body1Strong,
  Button,
  FluentProvider,
  Spinner,
  Text,
  Title1,
  Title2,
  makeStyles,
  shorthands,
  tokens
} from "@fluentui/react-components";
import type {
  AnalysisRunRequest,
  AnalysisRunResponse,
  CommitteeSubmissionRequest,
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
import { strattonTheme } from "../theme/strattonTheme.js";
import { AppRoutes } from "./routes.js";

const useStyles = makeStyles({
  fullScreen: {
    display: "grid",
    placeItems: "center",
    minHeight: "100vh",
    backgroundColor: "#e8e6df",
    backgroundImage:
      "linear-gradient(135deg, rgba(11, 34, 59, 0.035) 0%, rgba(255, 255, 255, 0) 42%)",
    ...shorthands.padding(tokens.spacingVerticalXXL, tokens.spacingHorizontalXXL)
  },
  signInFrame: {
    display: "grid",
    gridTemplateColumns: "minmax(360px, 0.9fr) minmax(440px, 1.1fr)",
    width: "min(1040px, 100%)",
    minHeight: "610px",
    overflow: "hidden",
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: "0 24px 70px rgba(11, 34, 59, 0.16)",
    ...shorthands.borderRadius("12px"),
    "@media (max-width: 800px)": {
      gridTemplateColumns: "1fr",
      minHeight: "auto"
    }
  },
  signInBrand: {
    position: "relative",
    display: "grid",
    alignContent: "space-between",
    gap: tokens.spacingVerticalXXL,
    minHeight: "610px",
    color: "#ffffff",
    backgroundColor: "#081a2d",
    ...shorthands.padding("48px", "44px"),
    "::after": {
      content: '""',
      position: "absolute",
      insetInlineStart: "44px",
      insetInlineEnd: "44px",
      bottom: "42%",
      height: "1px",
      backgroundColor: "rgba(190, 157, 82, 0.55)"
    },
    "@media (max-width: 800px)": {
      minHeight: "360px"
    }
  },
  signInLogo: {
    width: "260px",
    maxWidth: "85%",
    aspectRatio: "1",
    objectFit: "contain",
    filter: "contrast(1.03)"
  },
  brandStatement: {
    display: "grid",
    gap: tokens.spacingVerticalS,
    position: "relative",
    zIndex: 1
  },
  brandTitle: {
    margin: 0,
    fontSize: "30px",
    fontWeight: 400,
    lineHeight: 1.15,
    letterSpacing: "0.01em"
  },
  brandCaption: {
    color: "#c8cdd3",
    maxWidth: "34ch",
    lineHeight: 1.6
  },
  signInPanel: {
    display: "grid",
    alignContent: "center",
    gap: tokens.spacingVerticalXL,
    ...shorthands.padding("64px", "64px"),
    "@media (max-width: 800px)": {
      ...shorthands.padding("40px", "28px")
    }
  },
  signInHeading: {
    display: "grid",
    gap: tokens.spacingVerticalS,
    maxWidth: "500px"
  },
  secureAccess: {
    color: "#8c6d2d",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase"
  },
  signInDetails: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground2,
    borderTop: "1px solid #d8d4ca",
    borderBottom: "1px solid #d8d4ca",
    ...shorthands.padding(tokens.spacingVerticalL, 0)
  },
  signInAction: {
    justifySelf: "start",
    minWidth: "220px"
  },
  stateCard: {
    display: "grid",
    gap: tokens.spacingVerticalL,
    width: "min(520px, 100%)",
    textAlign: "left",
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: "0 16px 44px rgba(11, 34, 59, 0.12)",
    borderTop: "4px solid #9a7932",
    ...shorthands.padding(tokens.spacingVerticalXXL, tokens.spacingHorizontalXXL),
    ...shorthands.borderRadius("8px")
  },
  stateLogo: {
    width: "92px",
    height: "92px",
    objectFit: "cover",
    objectPosition: "center 27%",
    ...shorthands.borderRadius("50%")
  },
  errorText: {
    color: tokens.colorPaletteRedForeground1
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

  const handleSubmitCommitteePack = useCallback(
    async (input: CommitteeSubmissionRequest) => {
      const nextScenario = await client.submitCommitteePack(input);
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
    <FluentProvider theme={strattonTheme}>
      <title>Stratton Europe Capital | Project Danube</title>

      {!account ? (
        <div className={styles.fullScreen}>
          <div className={styles.signInFrame}>
            <section className={styles.signInBrand} aria-label="Stratton Europe Capital">
              <img
                alt="Stratton Europe Capital"
                className={styles.signInLogo}
                src="/stratton-logo.png"
              />
              <div className={styles.brandStatement}>
                <h1 className={styles.brandTitle}>Investing in Europe’s Future</h1>
                <Body1 className={styles.brandCaption}>
                  A governed investment workflow for evidence, analysis, specialist review, and
                  committee preparation.
                </Body1>
              </div>
            </section>

            <section className={styles.signInPanel}>
              <div className={styles.signInHeading}>
                <Text className={styles.secureAccess}>Secure institutional access</Text>
                <Title1>Project Danube</Title1>
                <Body1>
                  Enter the Stratton deal environment using your approved Microsoft Entra account.
                </Body1>
              </div>

              <div className={styles.signInDetails}>
                <Body1Strong>Governed evidence-to-decision workspace</Body1Strong>
                <Body1>
                  Access is tenant-restricted. Analysis remains grounded in admitted evidence, and
                  investment authority remains with the human committee.
                </Body1>
              </div>

              <Button
                aria-label="Sign in with Microsoft"
                appearance="primary"
                className={styles.signInAction}
                disabled={isSignInPending}
                onClick={() => void handleSignIn()}
                size="large"
              >
                {isSignInPending ? "Opening secure session..." : "Continue with Microsoft"}
              </Button>
              {signInError ? (
                <Body1 className={styles.errorText} role="alert">
                  {signInError}
                </Body1>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}

      {account && isLoading && !scenario ? (
        <div className={styles.fullScreen}>
          <div className={styles.stateCard}>
            <img alt="" className={styles.stateLogo} src="/stratton-logo.png" />
            <Spinner label="Loading Project Danube..." labelPosition="below" size="huge" />
          </div>
        </div>
      ) : null}

      {account && !isLoading && !scenario ? (
        <div className={styles.fullScreen}>
          <div className={styles.stateCard} role="alert">
            <img alt="" className={styles.stateLogo} src="/stratton-logo.png" />
            <Title2>Unable to load Project Danube</Title2>
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
            accountDisplayName={account?.displayName ?? "Authenticated user"}
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
              onStartNewCycle={handleReset}
              onSubmitCommitteePack={handleSubmitCommitteePack}
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
