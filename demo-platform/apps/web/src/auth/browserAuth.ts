import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo
} from "@azure/msal-browser";
import { z } from "zod";

const entraClientId = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
);

const runtimeAuthConfigSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("LOCAL") }).strict(),
  z
    .object({
      mode: z.literal("AZURE"),
      authority: z.string().url(),
      clientId: entraClientId,
      bffScope: z.string().trim().min(1)
    })
    .strict()
]);

export type RuntimeAuthConfig = z.infer<typeof runtimeAuthConfigSchema>;

export interface BrowserAuthAccount {
  readonly displayName: string;
}

export interface BrowserAuthSession {
  readonly mode: "LOCAL" | "AZURE";
  readonly account: BrowserAuthAccount | null;
  signIn(): Promise<void>;
  getAccessToken(): Promise<string | undefined>;
}

export async function loadRuntimeAuthConfig(): Promise<RuntimeAuthConfig> {
  if (import.meta.env.DEV) {
    return { mode: "LOCAL" };
  }

  const response = await fetch("/auth/config", {
    headers: {
      accept: "application/json"
    }
  });
  if (!response.ok) {
    throw new Error("AUTH_CONFIGURATION_UNAVAILABLE");
  }
  return runtimeAuthConfigSchema.parse(await response.json());
}

export async function createBrowserAuthSession(
  config: RuntimeAuthConfig
): Promise<BrowserAuthSession> {
  if (config.mode === "LOCAL") {
    return createLocalBrowserAuthSession();
  }

  const client = new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: config.authority,
      redirectUri: window.location.origin
    },
    cache: {
      cacheLocation: "sessionStorage"
    }
  });
  await client.initialize();
  let account = client.getAllAccounts()[0] ?? null;

  return {
    mode: "AZURE",
    get account() {
      return toBrowserAccount(account);
    },
    async signIn() {
      const result = await client.loginPopup({
        scopes: [config.bffScope],
        prompt: "select_account"
      });
      account = result.account;
    },
    async getAccessToken() {
      if (!account) {
        throw new Error("MICROSOFT_SIGN_IN_REQUIRED");
      }

      try {
        const result = await client.acquireTokenSilent({
          account,
          scopes: [config.bffScope]
        });
        return result.accessToken;
      } catch (error) {
        if (!(error instanceof InteractionRequiredAuthError)) {
          throw error;
        }
        const result = await client.acquireTokenPopup({
          account,
          scopes: [config.bffScope]
        });
        account = result.account;
        return result.accessToken;
      }
    }
  };
}

export function createLocalBrowserAuthSession(): BrowserAuthSession {
  return {
    mode: "LOCAL",
    account: {
      displayName: "Local demo user"
    },
    async signIn() {},
    async getAccessToken() {
      return undefined;
    }
  };
}

function toBrowserAccount(account: AccountInfo | null): BrowserAuthAccount | null {
  if (!account) {
    return null;
  }
  return {
    displayName: account.name?.trim() || account.username
  };
}
