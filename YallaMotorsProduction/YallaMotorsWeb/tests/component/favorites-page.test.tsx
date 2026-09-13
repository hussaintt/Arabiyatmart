import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createListingCard } from '../fixtures/factories';
import type { ListingCursorResponse } from '@/types/listing';

vi.mock('server-only', () => ({}));

const state = vi.hoisted(() => ({
  browserRequest: vi.fn(),
  removeFavorite: vi.fn(),
  addFavorite: vi.fn(),
  requireSession: vi.fn(),
  getFavorites: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/en/favorites',
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => <a href={href} {...props}>{children}</a>,
  usePathname: () => '/en/favorites',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn() }));
vi.mock('next/image', () => ({
  default: ({ src, alt, fill: _fill, priority: _priority, sizes: _sizes, ...props }: { src: string; alt: string; fill?: boolean; priority?: boolean; sizes?: string; [key: string]: unknown }) => {
    void _fill;
    void _priority;
    void _sizes;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  },
}));
vi.mock('@/providers/session-provider', () => ({
  useSession: () => ({ session: { user: { publicId: 'usr_1' } }, status: 'authenticated' }),
}));
vi.mock('@/lib/api/browser', () => ({ browserApiRequest: (...args: unknown[]) => state.browserRequest(...args) }));
vi.mock('@/server/actions/favorites', () => ({
  removeFavorite: (...args: unknown[]) => state.removeFavorite(...args),
  addFavorite: (...args: unknown[]) => state.addFavorite(...args),
}));
vi.mock('@/lib/auth/guards', () => ({ requireSession: (...args: unknown[]) => state.requireSession(...args) }));
vi.mock('@/server/queries/favorites', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/queries/favorites')>();
  return { ...actual, getFavorites: (...args: unknown[]) => state.getFavorites(...args) };
});

import FavoritesPage, { generateMetadata } from '@/app/[locale]/(account)/favorites/page';
import FavoritesLoading from '@/app/[locale]/(account)/favorites/loading';
import { FavoritesList } from '@/components/favorites/favorites-list';
import { enforceFavoriteCursorContract } from '@/server/queries/favorites';

const first = createListingCard({ publicId: 'lst_first', slug: 'first-car', title: 'First car', coverImageUrl: null, isFavorited: true });
const second = createListingCard({ publicId: 'lst_second', slug: 'second-car', title: 'Second car', coverImageUrl: null, isFavorited: true });
const third = createListingCard({ publicId: 'lst_third', slug: 'third-car', title: 'Third car', coverImageUrl: null, isFavorited: true });

const firstPage: ListingCursorResponse = { data: [first, second], meta: { hasMore: true, nextCursor: 'opaque_cursor_page_2' } };
const secondPage: ListingCursorResponse = { data: [second, third], meta: { hasMore: false, nextCursor: null } };

function renderList(page: ListingCursorResponse = firstPage) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}><FavoritesList initialPage={page} locale="en" /></QueryClientProvider>) };
}

describe('TASK-040: private favorites cursor route', () => {
  beforeEach(() => {
    state.browserRequest.mockResolvedValue(secondPage);
    state.removeFavorite.mockResolvedValue({ ok: true, data: { favorited: false } });
    state.addFavorite.mockResolvedValue({ ok: true, data: { favorited: true } });
    state.requireSession.mockResolvedValue({ user: { publicId: 'usr_1' } });
    state.getFavorites.mockResolvedValue(firstPage);
  });

  afterEach(() => cleanup());

  it('uses the exact opaque next cursor and removes page overlap in stable order', async () => {
    renderList();
    fireEvent.click(screen.getByTestId('favorites-load-more'));
    await waitFor(() => expect(state.browserRequest).toHaveBeenCalledTimes(1));
    expect(state.browserRequest.mock.calls[0]?.[0].path).toBe('/api/bff/me/favorites?limit=20&cursor=opaque_cursor_page_2');
    await screen.findByText('Third car');
    expect(screen.getAllByText('Second car')).toHaveLength(1);
    const titles = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent);
    expect(titles).toEqual(['First car', 'Second car', 'Third car']);
  });

  it('rejects a hasMore response without a usable next cursor', () => {
    expect(() => enforceFavoriteCursorContract({ data: [], meta: { hasMore: true, nextCursor: null } })).toThrow(/FAV-01/);
    expect(() => enforceFavoriteCursorContract({ data: [], meta: { hasMore: true } })).toThrow();
  });

  it('removes a favorite optimistically and rolls it back on server failure', async () => {
    let resolveRemoval!: (value: unknown) => void;
    state.removeFavorite.mockImplementationOnce(() => new Promise((resolve) => { resolveRemoval = resolve; }));
    renderList({ data: [first], meta: { hasMore: false, nextCursor: null } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove from favorites' }));
    await waitFor(() => expect(screen.queryByText('First car')).not.toBeInTheDocument());
    resolveRemoval({ ok: false, error: { status: 500, code: 'FAILED', message: 'Try again', requestId: 'req_3', fieldErrors: [], details: null, retryAfterSeconds: null } });
    await waitFor(() => expect(screen.getByText('First car')).toBeInTheDocument());
  });

  it('commits successful optimistic removal without duplicating the mutation', async () => {
    renderList({ data: [first, second], meta: { hasMore: false, nextCursor: null } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove from favorites' })[0]!);
    await waitFor(() => expect(screen.queryByText('First car')).not.toBeInTheDocument());
    expect(state.removeFavorite).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Second car')).toBeInTheDocument();
  });

  it('renders empty, loading, responsive and end states accessibly', () => {
    renderList({ data: [], meta: { hasMore: false, nextCursor: null } });
    expect(screen.getByTestId('favorites-empty')).toBeInTheDocument();
    cleanup();
    const loading = render(<FavoritesLoading />);
    expect(loading.container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(loading.container.innerHTML).toContain('grid-cols-1');
  });

  it('server-renders the first private page, guards auth, and emits canonical noindex metadata', async () => {
    const page = await FavoritesPage({ params: Promise.resolve({ locale: 'en' }) });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}>{page}</QueryClientProvider>);
    expect(state.requireSession).toHaveBeenCalledWith('/en/favorites', 'en');
    expect(state.getFavorites).toHaveBeenCalledWith({ limit: 20 });
    expect(screen.getByTestId('favorites-page')).toBeInTheDocument();
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates?.canonical).toMatch(/\/en\/favorites$/);
    expect(JSON.stringify(metadata)).not.toContain('cursor');
  });

  it('does not read favorites when the authoritative session guard rejects', async () => {
    state.requireSession.mockRejectedValueOnce(new Error('NEXT_REDIRECT:/en/login'));
    await expect(FavoritesPage({ params: Promise.resolve({ locale: 'en' }) })).rejects.toThrow('NEXT_REDIRECT');
    expect(state.getFavorites).not.toHaveBeenCalled();
  });
});
