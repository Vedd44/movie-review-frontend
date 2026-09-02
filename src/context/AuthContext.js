import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSupabaseClient, isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { trackProductEvent } from "../analytics";
import { tasteProfileService } from "../services/tasteProfileService";

export const PENDING_SAVE_KEY = "reelbotPendingMovieSave";
const AUTH_TIMEOUT_MS = 15000;

const withAuthTimeout = (promise, actionLabel) => new Promise((resolve, reject) => {
  const timeoutId = window.setTimeout(() => reject(new Error(`${actionLabel} timed out. Try again.`)), AUTH_TIMEOUT_MS);
  Promise.resolve(promise).then(
    (value) => {
      window.clearTimeout(timeoutId);
      resolve(value);
    },
    (error) => {
      window.clearTimeout(timeoutId);
      reject(error);
    }
  );
});

const getAuthRedirectUrl = () => {
  if (typeof window === "undefined") return "https://reelbot.movie/";
  return ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? `${window.location.origin}/`
    : "https://reelbot.movie/";
};

export const completePendingMovieSave = () => {
  if (typeof window === "undefined") return null;
  try {
    const movie = JSON.parse(window.localStorage.getItem(PENDING_SAVE_KEY) || "null");
    if (!movie?.id) return null;
    const profile = tasteProfileService.load();
    const state = tasteProfileService.getMovieTasteState(profile, movie.id);
    if (!state.inWatchlist) tasteProfileService.save(tasteProfileService.toggleWatchlist(profile, movie));
    window.localStorage.removeItem(PENDING_SAVE_KEY);
    return movie;
  } catch (error) {
    console.error("Could not complete pending ReelBot save:", error);
    return null;
  }
};

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  authReady: false,
  authError: "",
  authPromptOpen: false,
  lastMagicLinkEmail: "",
  passwordRecoveryActive: false,
  sendMagicLink: async () => {},
  signInWithPassword: async () => {},
  signUpWithPassword: async () => {},
  sendPasswordReset: async () => {},
  updatePassword: async () => {},
  signOut: async () => {},
  updateDisplayName: async () => {},
  deleteAccount: async () => {},
  maybePromptToSavePicks: () => {},
  openAuthPrompt: () => {},
  requestMovieSaveAuth: () => {},
  closeAuthPrompt: () => {},
  clearPasswordRecovery: () => {},
  clearAuthError: () => {},
});

function isRecoveryUrl() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.href.includes("type=recovery");
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [lastMagicLinkEmail, setLastMagicLinkEmail] = useState("");
  const [authPromptSource, setAuthPromptSource] = useState("");
  const [passwordRecoveryActive, setPasswordRecoveryActive] = useState(() => isRecoveryUrl());
  const [pendingRecoverySession, setPendingRecoverySession] = useState(null);

  const openAuthPrompt = useCallback((source = "") => {
    trackProductEvent("signup_started", { source: source || "account" });
    setAuthPromptSource(source);
    setAuthPromptOpen(true);
  }, []);

  const closeAuthPrompt = useCallback(() => {
    setAuthPromptOpen(false);
    setAuthPromptSource("");
  }, []);

  const navigate = useNavigate();
  const recoveryRedirectedRef = useRef(false);

  const clearPasswordRecovery = useCallback(() => {
    setPasswordRecoveryActive(false);
    setPendingRecoverySession(null);
    recoveryRedirectedRef.current = false;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    withAuthTimeout(getSupabaseClient().auth.getSession(), "Restoring the account session")
      .then(({ data, error }) => {
        if (cancelled) {
          return;
        }

        if (error) {
          setAuthError(error.message || "Could not restore your account session.");
        }

        const enteringRecovery = isRecoveryUrl();
        setPasswordRecoveryActive(enteringRecovery);
        if (enteringRecovery) {
          setPendingRecoverySession(data?.session || null);
          setSession(null);
        } else {
          setPendingRecoverySession(null);
          if (data?.session?.user) completePendingMovieSave();
          setSession(data?.session || null);
        }
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setAuthError(error.message || "Could not restore your account session.");
        setLoading(false);
      });

      const { data: listener } = getSupabaseClient().auth.onAuthStateChange((event, nextSession) => {
        if (event === "PASSWORD_RECOVERY") {
          setPasswordRecoveryActive(true);
          setPendingRecoverySession(nextSession || null);
          if (!recoveryRedirectedRef.current) {
            recoveryRedirectedRef.current = true;
            navigate("/reset-password", { replace: true });
          }
        } else if (event === "SIGNED_OUT") {
          setPasswordRecoveryActive(false);
          setPendingRecoverySession(null);
          recoveryRedirectedRef.current = false;
        } else if (event === "SIGNED_IN" && !recoveryRedirectedRef.current && !isRecoveryUrl()) {
          setPasswordRecoveryActive(false);
        }

        if (event === "PASSWORD_RECOVERY") {
          setSession(null);
        } else {
          setPendingRecoverySession(null);
          if (nextSession?.user) completePendingMovieSave();
          setSession(nextSession || null);
        }
        setLoading(false);
        if (nextSession?.user) {
          closeAuthPrompt();
        }
      });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [closeAuthPrompt, navigate]);

  const sendMagicLink = useCallback(async (email) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase is not configured.");
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const response = await withAuthTimeout(getSupabaseClient().auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo: getAuthRedirectUrl() },
    }), "Sending the sign-in link");
    const { error } = response;

    if (error) {
      setAuthError(error.message || "We couldn't send the sign-in link.");
      throw error;
    }

    setAuthError("");
    setLastMagicLinkEmail(normalizedEmail);
    return response;
  }, []);

  const signInWithPassword = useCallback(async ({ email, password }) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase is not configured.");
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const response = await withAuthTimeout(getSupabaseClient().auth.signInWithPassword({
      email: normalizedEmail,
      password,
    }), "Signing in");
    const { error } = response;

    if (error) {
      setAuthError(error.message || "We couldn't log you in right now.");
      throw error;
    }

    setAuthError("");
    return response;
  }, []);

  const signUpWithPassword = useCallback(async ({ email, password, displayName = "" }) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase is not configured.");
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedName = String(displayName || "").trim();
    const response = await withAuthTimeout(getSupabaseClient().auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: normalizedName ? { display_name: normalizedName } : {},
        emailRedirectTo: getAuthRedirectUrl(),
      },
    }), "Creating the account");
    const { error } = response;

    if (error) {
      setAuthError(error.message || "We couldn't create your account right now.");
      throw error;
    }

    setAuthError("");
    trackProductEvent("signup_completed", { method: "email" });
    return response;
  }, []);

  const sendPasswordReset = useCallback(async (email) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase is not configured.");
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const redirectTo = typeof window !== "undefined"
      ? `${window.location.origin}/reset-password`
      : undefined;

    const response = await withAuthTimeout(getSupabaseClient().auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    }), "Sending the reset link");
    const { error } = response;

    if (error) {
      setAuthError(error.message || "We couldn't send the reset link.");
      throw error;
    }

    setAuthError("");
    return response;
  }, []);

  const updatePassword = useCallback(async (password) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase is not configured.");
    }

    const response = await getSupabaseClient().auth.updateUser({
      password,
    });
    const { data, error } = response;

    if (error) {
      setAuthError(error.message || "We couldn't update your password.");
      throw error;
    }

    setAuthError("");
    setPasswordRecoveryActive(false);
    setSession((currentSession) => ({
      ...(currentSession || {}),
      user: data.user || currentSession?.user || null,
    }));
    return data.user;
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
    setPasswordRecoveryActive(false);
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
    setPasswordRecoveryActive(false);
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

  const requestMovieSaveAuth = useCallback((movie) => {
    if (!movie?.id || typeof window === "undefined") return;
    window.localStorage.setItem(PENDING_SAVE_KEY, JSON.stringify(movie));
    openAuthPrompt("save_movie");
  }, [openAuthPrompt]);

  const value = useMemo(
    () => ({
      user: passwordRecoveryActive ? null : session?.user || null,
      session,
      loading,
      authReady: !loading,
      authError,
      authPromptOpen,
      authPromptSource,
      lastMagicLinkEmail,
      passwordRecoveryActive,
      recoverySession: pendingRecoverySession,
      sendMagicLink,
      signInWithPassword,
      signUpWithPassword,
      sendPasswordReset,
      updatePassword,
      signOut,
      updateDisplayName,
      deleteAccount,
      maybePromptToSavePicks,
      openAuthPrompt,
      requestMovieSaveAuth,
      closeAuthPrompt,
      clearPasswordRecovery,
      clearAuthError: () => setAuthError(""),
    }),
    [
      authError,
      authPromptOpen,
      authPromptSource,
      clearPasswordRecovery,
      closeAuthPrompt,
      deleteAccount,
      lastMagicLinkEmail,
      loading,
      maybePromptToSavePicks,
      openAuthPrompt,
      requestMovieSaveAuth,
      passwordRecoveryActive,
      pendingRecoverySession,
      sendMagicLink,
      sendPasswordReset,
      session,
      signInWithPassword,
      signOut,
      signUpWithPassword,
      updateDisplayName,
      updatePassword,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
