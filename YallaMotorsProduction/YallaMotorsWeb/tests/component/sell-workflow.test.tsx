import * as React from "react";
import { renderToString } from "react-dom/server";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../setup/msw-server";
import { SellWorkflow } from "@/components/sell/sell-workflow";
import {
  SELL_DRAFT_VERSION,
  createEmptySellDraft,
  createInitialSellWizardState,
  getSellDraftStorageKey,
  hashSellDraftUserPublicId,
} from "@/stores/sell-store";

describe("TASK-043: sell workflow shell", () => {
  beforeEach(() => {
    server.use(
      http.get("*/api/bff/taxonomy/makes", () => {
        return HttpResponse.json({ data: [] });
      }),
    );
    localStorage.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("keeps server/client initial DOM stable, then offers explicit same-user recovery", async () => {
    const userPublicId = "usr_hydration";
    const recovered = { ...createEmptySellDraft(), condition: "USED" as const };
    localStorage.setItem(
      getSellDraftStorageKey(userPublicId),
      JSON.stringify({
        version: SELL_DRAFT_VERSION,
        userHash: hashSellDraftUserPublicId(userPublicId),
        draft: recovered,
      }),
    );

    const serverHtml = renderToString(
      <SellWorkflow userPublicId={userPublicId} locale="en" />,
    );
    expect(serverHtml).toContain('data-testid="sell-step-condition"');
    expect(serverHtml).not.toContain("Restore your draft?");

    render(<SellWorkflow userPublicId={userPublicId} locale="en" />);
    expect(screen.getByTestId("sell-step-condition")).toBeInTheDocument();
    expect(
      await screen.findByTestId("draft-recovery-dialog"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("restore-sell-draft"));
    await waitFor(() =>
      expect(
        screen.queryByTestId("draft-recovery-dialog"),
      ).not.toBeInTheDocument(),
    );
  });

  it("discards a recovered draft and removes only the current account key", async () => {
    const currentUser = "usr_current";
    const otherUser = "usr_other";
    const payload = (user: string) =>
      JSON.stringify({
        version: SELL_DRAFT_VERSION,
        userHash: hashSellDraftUserPublicId(user),
        draft: { ...createEmptySellDraft(), condition: "NEW" },
      });
    localStorage.setItem(
      getSellDraftStorageKey(currentUser),
      payload(currentUser),
    );
    localStorage.setItem(getSellDraftStorageKey(otherUser), payload(otherUser));
    render(<SellWorkflow userPublicId={currentUser} locale="en" />);

    fireEvent.click(await screen.findByTestId("discard-sell-draft"));
    await waitFor(() =>
      expect(
        screen.queryByTestId("draft-recovery-dialog"),
      ).not.toBeInTheDocument(),
    );
    expect(
      localStorage.getItem(getSellDraftStorageKey(currentUser)),
    ).toBeNull();
    expect(
      localStorage.getItem(getSellDraftStorageKey(otherUser)),
    ).not.toBeNull();
  });

  it("prevents rapid double-next, supports Back, and exposes responsive rails", async () => {
    const initial = createInitialSellWizardState({
      ...createEmptySellDraft(),
      condition: "USED",
    });
    render(
      <SellWorkflow
        userPublicId="usr_navigation"
        locale="en"
        initialState={initial}
      />,
    );
    const workflow = screen.getByTestId("sell-workflow");
    expect(workflow).toHaveClass(
      "grid-cols-1",
      "lg:grid-cols-[15rem_minmax(0,1fr)]",
    );
    expect(screen.getByTestId("sell-step-rail")).toHaveClass("lg:block");

    const next = screen.getByTestId("sell-next");
    fireEvent.click(next);
    fireEvent.click(next);
    expect(await screen.findByTestId("sell-step-vehicle")).toBeInTheDocument();
    expect(screen.queryByTestId("sell-step-details")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("sell-back"));
    expect(
      await screen.findByTestId("sell-step-condition"),
    ).toBeInTheDocument();
  });

  it("disables both navigation directions while validation/submission is pending", () => {
    const initial = createInitialSellWizardState({
      ...createEmptySellDraft(),
      condition: "USED",
    });
    initial.currentStep = "vehicle";
    initial.isSubmitting = true;
    render(
      <SellWorkflow
        userPublicId="usr_pending"
        locale="ar"
        initialState={initial}
      />,
    );
    expect(screen.getByTestId("sell-back")).toBeDisabled();
    expect(screen.getByTestId("sell-next")).toBeDisabled();
    expect(
      screen.getByRole("heading", { level: 1, name: "السيارة" }),
    ).toBeInTheDocument();
  });
});
