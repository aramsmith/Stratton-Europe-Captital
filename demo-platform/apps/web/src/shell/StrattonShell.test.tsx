import axe from "axe-core";
import { fireEvent, render, screen } from "@testing-library/react";
import { createProjectDanubeState } from "@stratton/scenario-data";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { StrattonShell } from "./StrattonShell.js";

function renderShell(path = "/workbench", onReset = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StrattonShell scenario={createProjectDanubeState()} onReset={onReset}>
        <div>Route body</div>
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
    expect(screen.getByRole("link", { name: "Governance & Assurance" })).toBeVisible();
  });

  it("marks the selected workspace as the current page", () => {
    renderShell("/decision-room");

    expect(screen.getByRole("link", { name: "Investment Decision Room" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("requires confirmation before resetting the scenario", () => {
    const onReset = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderShell("/workbench", onReset);
    fireEvent.click(screen.getByRole("button", { name: "Reset demo scenario" }));

    expect(confirmSpy).toHaveBeenCalledWith(
      "Reset Project Danube to the approved baseline? This will discard the current demo session state."
    );
    expect(onReset).not.toHaveBeenCalled();
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
