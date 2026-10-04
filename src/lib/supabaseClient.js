const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let clientPromise = null;
let providersPromise = null;

export const getAuthProviders = () => {
  if (!isSupabaseConfigured || typeof fetch !== "function") return Promise.resolve({});
  if (!providersPromise) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    providersPromise = fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey }, signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error("Provider settings unavailable");
      return (await response.json()).external || {};
    }).catch(() => { providersPromise = null; return {}; }).finally(() => clearTimeout(timeout));
  }
  return providersPromise;
};

export const getSupabaseClient = async () => {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    );
  }

  return clientPromise;
};
