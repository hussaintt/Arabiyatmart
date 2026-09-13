import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../setup/msw-server';
import {
  createListingCard,
  createApiError,
  FIXED_TIMESTAMP,
  FIXED_LISTING_ID,
  type ListingCard,
  type ApiErrorBody,
} from '../fixtures/factories';

describe('Contract Smoke Suite', () => {
  it('receives deterministic mocked BFF contract payload', async () => {
    const mockCard = createListingCard({
      publicId: FIXED_LISTING_ID,
      title: 'تويوتا كورولا 2024',
    });

    server.use(
      http.get('https://api.arabiyatmart.com/v1/listings/test', () => {
        return HttpResponse.json({
          data: mockCard,
          timestamp: FIXED_TIMESTAMP,
        });
      })
    );

    const response = await fetch('https://api.arabiyatmart.com/v1/listings/test');
    expect(response.status).toBe(200);

    const body = (await response.json()) as { readonly data: ListingCard; readonly timestamp: string };
    expect(body.data.publicId).toBe(FIXED_LISTING_ID);
    expect(body.data.priceCents).toBe(65000000);
    expect(Number.isInteger(body.data.priceCents)).toBe(true);
    expect(body.timestamp).toBe(FIXED_TIMESTAMP);
  });

  it('receives deterministic error envelope contract', async () => {
    const errorBody = createApiError({
      status: 404,
      code: 'NOT_FOUND',
      message: 'الإعلان غير موجود',
    });

    server.use(
      http.get('https://api.arabiyatmart.com/v1/listings/non-existent', () => {
        return HttpResponse.json(errorBody, { status: 404 });
      })
    );

    const response = await fetch('https://api.arabiyatmart.com/v1/listings/non-existent');
    expect(response.status).toBe(404);

    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.status).toBe(404);
    expect(body.error.message).toBe('الإعلان غير موجود');
  });

  it('fails deterministically when an unhandled HTTP request is dispatched', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(fetch('https://api.arabiyatmart.com/v1/unhandled-request')).rejects.toThrow();

    consoleSpy.mockRestore();
  });
});
