import { createProjectDanubeState } from "@stratton/scenario-data";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";

describe("App authentication", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers an explicit Microsoft sign-in before calling the API in AZURE mode", async () => {
    const signIn = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <App
        authSession={{
          mode: "AZURE",
          account: null,
          signIn,
          getAccessToken: vi.fn()
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign in with Microsoft" }));
    await act(async () => undefined);

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("acquires a delegated token before loading the scenario after sign-in", async () => {
    const scenario = createProjectDanubeState();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(scenario), { status: 200 }));
    const getAccessToken = vi.fn().mockResolvedValue("browser-delegated-token");
    vi.stubGlobal("fetch", fetchMock);

    render(
      <App
        authSession={{
          mode: "AZURE",
          account: {
            displayName: "Elena Müller"
          },
          signIn: vi.fn(),
          getAccessToken
        }}
      />
    );

    expect(await screen.findByRole("heading", { name: "Project Danube" })).toBeVisible();
    expect(getAccessToken).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/api/scenario", {
      signal: expect.any(AbortSignal),
      headers: {
        authorization: "Bearer browser-delegated-token"
      }
    });
  });
});
