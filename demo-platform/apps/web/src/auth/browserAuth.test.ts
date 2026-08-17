import { beforeEach, describe, expect, it, vi } from "vitest";

const initialize = vi.fn();
const handleRedirectPromise = vi.fn();
const getAllAccounts = vi.fn();
const loginRedirect = vi.fn();
const acquireTokenSilent = vi.fn();
const acquireTokenRedirect = vi.fn();

vi.mock("@azure/msal-browser", () => ({
  InteractionRequiredAuthError: class InteractionRequiredAuthError extends Error {},
  PublicClientApplication: class PublicClientApplication {
    initialize = initialize;
    handleRedirectPromise = handleRedirectPromise;
    getAllAccounts = getAllAccounts;
    loginRedirect = loginRedirect;
    acquireTokenSilent = acquireTokenSilent;
    acquireTokenRedirect = acquireTokenRedirect;
  }
}));

import { createBrowserAuthSession } from "./browserAuth.js";

const config = {
  mode: "AZURE" as const,
  authority: "https://login.microsoftonline.com/tenant-id",
  clientId: "11111111-1111-1111-1111-111111111111",
  bffScope: "api://22222222-2222-2222-2222-222222222222/access_as_user"
};

describe("createBrowserAuthSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initialize.mockResolvedValue(undefined);
    handleRedirectPromise.mockResolvedValue(null);
    getAllAccounts.mockReturnValue([]);
    loginRedirect.mockResolvedValue(undefined);
    acquireTokenRedirect.mockResolvedValue(undefined);
  });

  it("restores the account from a completed same-tab redirect", async () => {
    handleRedirectPromise.mockResolvedValue({
      account: { name: "Aram Smith", username: "aram@azurelab.nl" }
    });

    const session = await createBrowserAuthSession(config);

    expect(session.account).toEqual({ displayName: "Aram Smith" });
  });

  it("starts sign-in with a same-tab PKCE redirect", async () => {
    const session = await createBrowserAuthSession(config);

    await session.signIn();

    expect(loginRedirect).toHaveBeenCalledWith({
      scopes: [config.bffScope],
      prompt: "select_account"
    });
  });
});
