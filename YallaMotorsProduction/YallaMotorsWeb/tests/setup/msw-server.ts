import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const server = setupServer(
  http.post('*/api/bff/telemetry/boundary-error', () => {
    return new HttpResponse(null, { status: 204 });
  }),
);
