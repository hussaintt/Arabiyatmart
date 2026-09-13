import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  SavedSearch,
  SavedSearchListResponse,
} from "@/types/saved-search";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  browserRequest: vi.fn(),
  createSavedSearch: vi.fn(),
  updateSavedSearch: vi.fn(),
  deleteSavedSearch: vi.fn(),
  requireSession: vi.fn(),
  listSavedSearches: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("@/i18n/routing", () => ({
  Link: ({
    href,
    locale: _locale,
    children,
    ...props
  }: {
    href: string;
    locale?: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => {
    void _locale;
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));
vi.mock("@/lib/api/browser", () => ({
  browserApiRequest: (...args: unknown[]) => state.browserRequest(...args),
}));
vi.mock("@/server/actions/saved-searches", () => ({
  createSavedSearch: (...args: unknown[]) => state.createSavedSearch(...args),
  updateSavedSearch: (...args: unknown[]) => state.updateSavedSearch(...args),
  deleteSavedSearch: (...args: unknown[]) => state.deleteSavedSearch(...args),
}));
vi.mock("@/lib/auth/guards", () => ({
  requireSession: (...args: unknown[]) => state.requireSession(...args),
}));
vi.mock("@/server/queries/saved-searches", () => ({
  listSavedSearches: (...args: unknown[]) => state.listSavedSearches(...args),
}));

import SavedSearchesPage, {
  generateMetadata,
} from "@/app/[locale]/(account)/saved-searches/page";
import {
  buildSavedSearchRunHref,
  SavedSearchList,
} from "@/components/saved-search/saved-search-list";

const savedSearch: SavedSearch = {
  publicId: "ss_01",
  name: "Toyota deals",
  query: {
    makeSlug: "toyota",
    modelSlug: "corolla",
    condition: "USED",
    yearMin: 2020,
    priceMax: 2_000_000,
  },
  isActive: true,
  notifyPush: false,
  notifyEmail: true,
  lastMatchedAt: null,
  createdAt: "2026-09-08T10:00:00.000Z",
};

const initialData: SavedSearchListResponse = { data: [savedSearch] };

function renderList(data: SavedSearchListResponse = initialData) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <SavedSearchList initialData={data} locale="en" />
      </QueryClientProvider>,
    ),
  };
}

describe("TASK-041: saved-search management", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    state.browserRequest.mockResolvedValue(initialData);
    state.createSavedSearch.mockResolvedValue({ ok: true, data: savedSearch });
    state.updateSavedSearch.mockImplementation(
      async (_publicId: string, patch: Partial<SavedSearch>) => ({
        ok: true,
        data: { ...savedSearch, ...patch },
      }),
    );
    state.deleteSavedSearch.mockResolvedValue({
      ok: true,
      data: { acknowledged: true },
    });
    state.requireSession.mockResolvedValue({ user: { publicId: "usr_1" } });
    state.listSavedSearches.mockResolvedValue(initialData);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("rebuilds run links only from canonical allowlisted filters", () => {
    const href = buildSavedSearchRunHref("en", {
      makeSlug: "toyota",
      modelSlug: "corolla",
      yearMin: 2024,
      yearMax: 2020,
      priceMin: 50_000,
      q: "raw user query",
      sort: "PRICE_DESC",
      page: 9,
      panel: "filters",
      returnUrl: "https://evil.example/steal",
    });
    const url = new URL(href, "https://cars.example");

    expect(url.pathname).toBe("/en/search");
    expect(url.searchParams.get("makeSlug")).toBe("toyota");
    expect(url.searchParams.get("modelSlug")).toBe("corolla");
    expect(url.searchParams.has("q")).toBe(false);
    expect(url.searchParams.has("sort")).toBe(false);
    expect(url.searchParams.has("page")).toBe(false);
    expect(url.searchParams.has("panel")).toBe(false);
    expect(href).not.toContain("evil.example");
  });

  it("drops invalid dependent filters and renders the responsive RSC seed", () => {
    expect(
      buildSavedSearchRunHref("ar", {
        modelSlug: "corolla",
        areaId: 12,
      }),
    ).toBe("/ar/search");

    renderList();
    expect(screen.getByText("Toyota deals")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /run search/i })).toHaveAttribute(
      "href",
      expect.stringContaining("makeSlug=toyota"),
    );
    expect(screen.getByTestId("saved-search-grid")).toHaveClass(
      "grid-cols-1",
      "sm:grid-cols-2",
    );
  });

  it("optimistically toggles a preference and rolls back an authoritative failure", async () => {
    let resolveUpdate!: (value: unknown) => void;
    state.updateSavedSearch.mockImplementationOnce(
      () => new Promise((resolve) => (resolveUpdate = resolve)),
    );
    renderList();
    const toggle = screen.getByRole("switch", {
      name: "Browser notifications",
    });

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(state.updateSavedSearch).toHaveBeenCalledTimes(1);

    resolveUpdate({
      ok: false,
      error: {
        status: 500,
        code: "FAILED",
        message: "Could not update",
        requestId: "req_1",
        fieldErrors: [],
        details: null,
        retryAfterSeconds: null,
      },
    });
    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(screen.getByRole("alert")).toHaveTextContent("Could not update");
  });

  it("rolls an optimistic delete back when the server rejects it", async () => {
    let resolveDelete!: (value: unknown) => void;
    state.deleteSavedSearch.mockImplementationOnce(
      () => new Promise((resolve) => (resolveDelete = resolve)),
    );
    renderList();

    fireEvent.click(screen.getByTestId("delete-saved-search-ss_01"));
    fireEvent.click(
      await screen.findByTestId("confirm-delete-saved-search-ss_01"),
    );
    await waitFor(() =>
      expect(screen.queryByText("Toyota deals")).not.toBeInTheDocument(),
    );
    expect(state.deleteSavedSearch).toHaveBeenCalledTimes(1);

    resolveDelete({
      ok: false,
      error: {
        status: 409,
        code: "CONFLICT",
        message: "Delete rejected",
        requestId: "req_2",
        fieldErrors: [],
        details: null,
        retryAfterSeconds: null,
      },
    });
    await waitFor(() =>
      expect(screen.getByText("Toyota deals")).toBeInTheDocument(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Delete rejected");
  });

  it("creates from normalized fields and reconciles the returned server record", async () => {
    const returned: SavedSearch = {
      ...savedSearch,
      publicId: "ss_created",
      name: "Server normalized name",
      query: { makeSlug: "honda", modelSlug: "civic", condition: "NEW" },
      notifyPush: true,
      notifyEmail: false,
    };
    state.createSavedSearch.mockResolvedValueOnce({ ok: true, data: returned });
    renderList({ data: [] });

    fireEvent.click(screen.getByTestId("create-saved-search"));
    fireEvent.change(await screen.findByLabelText("Name (optional)"), {
      target: { value: "Local name" },
    });
    fireEvent.change(screen.getByLabelText("Make slug"), {
      target: { value: "honda" },
    });
    fireEvent.change(screen.getByLabelText("Model slug"), {
      target: { value: "civic" },
    });
    fireEvent.change(screen.getByLabelText("Condition"), {
      target: { value: "NEW" },
    });
    fireEvent.click(
      screen.getByText("Browser notifications", { selector: "span" }),
    );
    fireEvent.submit(screen.getByTestId("saved-search-form"));

    await waitFor(() =>
      expect(state.createSavedSearch).toHaveBeenCalledTimes(1),
    );
    expect(state.createSavedSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Local name",
        query: expect.objectContaining({
          makeSlug: "honda",
          modelSlug: "civic",
          condition: "NEW",
        }),
        notifyPush: true,
      }),
    );
    expect(
      await screen.findByText("Server normalized name"),
    ).toBeInTheDocument();
  });

  it("guards the private page before reading and emits canonical noindex metadata", async () => {
    const page = await SavedSearchesPage({
      params: Promise.resolve({ locale: "en" }),
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(<QueryClientProvider client={client}>{page}</QueryClientProvider>);

    expect(state.requireSession).toHaveBeenCalledWith(
      "/en/saved-searches",
      "en",
    );
    expect(state.listSavedSearches).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("saved-searches-page")).toBeInTheDocument();
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en" }),
    });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates?.canonical).toMatch(/\/en\/saved-searches$/);
  });

  it("does not read private data when the session guard rejects", async () => {
    state.requireSession.mockRejectedValueOnce(
      new Error("NEXT_REDIRECT:/en/login"),
    );
    await expect(
      SavedSearchesPage({ params: Promise.resolve({ locale: "en" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(state.listSavedSearches).not.toHaveBeenCalled();
  });
});
