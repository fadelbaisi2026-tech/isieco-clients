import { createApiClient } from "@isieco/api-client";
import { supabase } from "./supabase";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "/api/v1";

export const api = createApiClient({
  baseUrl: apiBaseUrl,
  getAccessToken: async () =>
    (await supabase.auth.getSession()).data.session?.access_token ?? null,
});
