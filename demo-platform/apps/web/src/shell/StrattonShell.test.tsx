import axe from "axe-core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createProjectDanubeState } from "@stratton/scenario-data";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../app/routes.js";
import { StrattonShell } from "./StrattonShell.js";

const scenario = createProjectDanubeState();

function renderShell(path = "/workbench", onReset = vi.fn(), children = <div>Route body</div>) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StrattonShell scenario={scenario} onReset={onReset}>
        {children}
      </StrattonShell>
    </MemoryRouter>
  );
}

function renderRouteShell(path = "/workbench") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StrattonShell scenario={scenario}>
        <AppRoutes scenario={scenario} />
      </StrattonShell>
    </MemoryRouter>
  );
}

describe("StrattonShell", () => {
  it("shows the three approved workspaces and the Project Danube case", () => {
    renderShell();

    expect(screen.getByRole("heading", { name: "Project Danube" })).toBeVisible();
    expect(screen.getByRole("link", { name: "AI Deal Workbench" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Investment Decision Room" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Governance & Assurance Console" })).toBeVisible();
  });

  it("marks the selected workspace as the current page", () => {
    renderShell("/decision-room");

    expect(screen.getByRole("link", { name: "Investment Decision Room" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("redirects a mistyped deep link back to the workbench", async () => {
    renderRouteShell("/workbnech");

    expect(await screen.findByRole("heading", { name: "AI Deal Workbench" })).toBeVisible();
    expect(screen.getByRole("link", { name: "AI Deal Workbench" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("button", { name: "AI Deal Workbench" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("requires explicit dialog confirmation before resetting the scenario", () => {
    const onReset = vi.fn().mockResolvedValue(undefined);

    renderShell("/workbench", onReset);
    fireEvent.click(screen.getByRole("button", { name: "Reset Project Danube" }));

    expect(screen.getByRole("dialog", { name: "Reset Project Danube" })).toBeVisible();
    expect(
      screen.getByText(
        "Reset Project Danube to the approved baseline? This will discard the current demo session state."
      )
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onReset).not.toHaveBeenCalled();
  });

  it("confirms reset through the dialog", async () => {
    const onReset = vi.fn().mockResolvedValue(undefined);

    renderShell("/workbench", onReset);
    fireEvent.click(screen.getByRole("button", { name: "Reset Project Danube" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm reset" }));
    });

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("has no axe violations", async () => {
    const { container } = renderShell();
    const results = await axe.run(container, {
      rules: {
        "color-contrast": { enabled: false }
      }
    });

    expect(results.violations).toHaveLength(0);
  });
});
