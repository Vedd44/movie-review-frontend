import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseClient, isSupabaseConfigured, supabase } from "../lib/supabaseClient";

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  authReady: false,
  authError: "",
  authPromptOpen: false,
  lastMagicLinkEmail: "",
  sendMagicLink: async () => {},
  signOut: async () => {},
  updateDisplayName: async () => {},
  deleteAccount: async () => {},
  maybePromptToSavePicks: () => {},
  openAuthPrompt: () => {},
  closeAuthPrompt: () => {},
  clearAuthError: () => {},
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [lastMagicLinkEmail, setLastMagicLinkEmail] = useState("");
  const [authPromptSource, setAuthPromptSource] = useState("");

  const openAuthPrompt = useCallback((source = "") => {
    setAuthPromptSource(source);
    setAuthPromptOpen(true);
  }, []);

  const closeAuthPrompt = useCallback(() => {
    setAuthPromptOpen(false);
    setAuthPromptSource("");
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    getSupabaseClient().auth.getSession()
      .then(({ data, error }) => {
        if (cancelled) {
          return;
        }

        if (error) {
          setAuthError(error.message || "Could not restore your account session.");
        }

        setSession(data?.session || null);
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setAuthError(error.message || "Could not restore your account session.");
        setLoading(false);
      });

    const { data: listener } = getSupabaseClient().auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      setLoading(false);
      if (nextSession?.user) {
        closeAuthPrompt();
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [closeAuthPrompt]);

  const sendMagicLink = useCallback(async (email) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase is not configured.");
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const response = await getSupabaseClient().auth.signInWithOtp({
      email: normalizedEmail,
    });
    console.log("Supabase response:", response);
    const { error } = response;

    if (error) {
      setAuthError(error.message || "We couldn't send the sign-in link.");
      throw error;
    }

    setAuthError("");
    setLastMagicLinkEmail(normalizedEmail);
    return response;
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    const { error } = await getSupabaseClient().auth.signOut();
    if (error) {
      setAuthError(error.message || "We couldn't log you out right now.");
      throw error;
    }

    setAuthError("");
    setLastMagicLinkEmail("");
  }, []);

  const updateDisplayName = useCallback(async (displayName) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase is not configured.");
    }

    const normalizedName = String(displayName || "").trim();
    const { data, error } = await getSupabaseClient().auth.updateUser({
      data: {
        display_name: normalizedName,
      },
    });

    if (error) {
      setAuthError(error.message || "We couldn't save your name.");
      throw error;
    }

    setAuthError("");
    setSession((currentSession) => ({
      ...(currentSession || {}),
      user: data.user || currentSession?.user || null,
    }));
    return data.user;
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase is not configured.");
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      throw new Error("No active session.");
    }

    const apiBaseUrl = process.env.REACT_APP_API_URL || "";
    const response = await fetch(`${apiBaseUrl}/auth/delete-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = payload?.error || "We couldn't delete your account right now.";
      setAuthError(message);
      throw new Error(message);
    }

    await getSupabaseClient().auth.signOut();
    setAuthError("");
    setLastMagicLinkEmail("");
    closeAuthPrompt();
  }, [closeAuthPrompt, session?.access_token]);

  const maybePromptToSavePicks = useCallback((source = "general") => {
    if (typeof window === "undefined" || session?.user) {
      return;
    }

    const storageKey = "reelbotAuthSoftPromptSeen";
    const seenPrompts = (() => {
      try {
        const rawValue = window.sessionStorage.getItem(storageKey);
        return rawValue ? JSON.parse(rawValue) : {};
      } catch (error) {
        return {};
      }
    })();

    if (seenPrompts[source]) {
      return;
    }

    seenPrompts[source] = true;
    window.sessionStorage.setItem(storageKey, JSON.stringify(seenPrompts));
    window.setTimeout(() => {
      openAuthPrompt(source);
    }, 700);
  }, [openAuthPrompt, session?.user]);

  const value = useMemo(
    () => ({
      user: session?.user || null,
      session,
      loading,
      authReady: !loading,
      authError,
      authPromptOpen,
      authPromptSource,
      lastMagicLinkEmail,
      sendMagicLink,
      signOut,
      updateDisplayName,
      deleteAccount,
      maybePromptToSavePicks,
      openAuthPrompt,
      closeAuthPrompt,
      clearAuthError: () => setAuthError(""),
    }),
    [authError, authPromptOpen, authPromptSource, closeAuthPrompt, deleteAccount, lastMagicLinkEmail, loading, maybePromptToSavePicks, openAuthPrompt, sendMagicLink, session, signOut, updateDisplayName]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
