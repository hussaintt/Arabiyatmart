import "server-only";

import { cookies } from "next/headers";
import { UPSTREAM_ENDPOINTS } from "@/lib/api/endpoints";
import { serverApiRequest } from "@/lib/api/server";
import {
  SavedSearchListResponseSchema,
  adaptRawSavedSearchList,
} from "@/lib/api/schemas/saved-search";
import { createCookieCredentialResolver } from "@/lib/auth/session";
import type { CookieStoreLike } from "@/lib/auth/cookies";
import type { SavedSearchListResponse } from "@/types/saved-search";

export async function listSavedSearches(): Promise<SavedSearchListResponse> {
  const store = await cookies();

  return serverApiRequest({
    operation: "listSavedSearches",
    method: "GET",
    endpoint: UPSTREAM_ENDPOINTS.savedSearches,
    outputSchema: SavedSearchListResponseSchema,
    authMode: "S",
    cachePolicy: { cache: "no-store", isPrivate: true },
    credentialResolver: createCookieCredentialResolver(
      store as unknown as CookieStoreLike,
    ),
    adapter: adaptRawSavedSearchList,
  });
}
