import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient";
import { API_BASE_URL } from "../discovery";
import { trackProductEvent } from "../analytics";
import { getAuthReturn } from "../authFlow";

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
  const authReturnRef = useRef(getAuthReturn());
  const [authNotice, setAuthNotice] = useState(() => authReturnRef.current?.kind === "error" ? authReturnRef.current : null);
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
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const recoveryRedirectedRef = useRef(false);
  const trackedSignedInUsersRef = useRef(new Set());

  const clearPasswordRecovery = useCallback(() => {
    setPasswordRecoveryActive(false);
    setPendingRecoverySession(null);
    recoveryRedirectedRef.current = false;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let subscription = null;

    const initializeAuth = async () => {
      try {
        const client = await getSupabaseClient();
        if (cancelled) return;

        const { data, error } = await withAuthTimeout(client.auth.getSession(), "Restoring the account session");
        if (cancelled) return;

        if (error) {
          setAuthError(error.message || "Could not restore your account session.");
        }

        const enteringRecovery = isRecoveryUrl() && Boolean(data?.session);
        setPasswordRecoveryActive(enteringRecovery);
        recoveryRedirectedRef.current = enteringRecovery;
        if (enteringRecovery) {
          setPendingRecoverySession(data?.session || null);
          setSession(null);
        } else {
          setPendingRecoverySession(null);
          setSession(data?.session || null);
        }
        setLoading(false);
        if (authReturnRef.current?.kind === "error") {
          if (window.location.pathname !== "/reset-password") setAuthPromptOpen(true);
          const url = new URL(window.location.href);
          ["error", "error_code", "error_description"].forEach(key => url.searchParams.delete(key));
          window.history.replaceState(window.history.state, "", url.pathname + url.search);
        } else if (authReturnRef.current?.kind === "confirmation" && data?.session?.user?.email_confirmed_at) {
          setAuthNotice({ kind: "success", message: "Your email is confirmed. You’re signed in." });
          trackProductEvent("sign_up", { method: "email", email_verified: true });
        }

        const { data: listener } = client.auth.onAuthStateChange((event, nextSession) => {
          if (event === "PASSWORD_RECOVERY") {
            setPasswordRecoveryActive(true);
            setPendingRecoverySession(nextSession || null);
            if (!recoveryRedirectedRef.current) {
              recoveryRedirectedRef.current = true;
              navigateRef.current("/reset-password", { replace: true });
            }
          } else if (event === "SIGNED_OUT") {
            setPasswordRecoveryActive(false);
            setPendingRecoverySession(null);
            recoveryRedirectedRef.current = false;
          } else if (event === "SIGNED_IN" && !recoveryRedirectedRef.current && !isRecoveryUrl()) {
            setPasswordRecoveryActive(false);
            const userId = nextSession?.user?.id;
            if (userId && !trackedSignedInUsersRef.current.has(userId)) {
              trackedSignedInUsersRef.current.add(userId);
              trackProductEvent("login", { method: nextSession.user.app_metadata?.provider || "email" });
            }
          }

          if (event !== "SIGNED_OUT" && (event === "PASSWORD_RECOVERY" || recoveryRedirectedRef.current)) {
            setPendingRecoverySession(nextSession || null);
            setSession(null);
          } else {
            setPendingRecoverySession(null);
            setSession(nextSession || null);
          }
          setLoading(false);
          if (nextSession?.user) closeAuthPrompt();
        });
        subscription = listener.subscription;
      } catch (error) {
        if (cancelled) return;
        if (authReturnRef.current?.kind === "error" && window.location.pathname !== "/reset-password") setAuthPromptOpen(true);
        setAuthError(error.message || "Could not restore your account session.");
        setLoading(false);
      }
    };

    // Let the first paint complete before loading the account SDK. Signed-in
    // sessions are still restored immediately after the browser becomes idle.
    const timer = window.setTimeout(initializeAuth, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      subscription?.unsubscribe();
    };
  }, [closeAuthPrompt]);

  const sendMagicLink = useCallback(async (email) => {
    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured.");
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const response = await withAuthTimeout((await getSupabaseClient()).auth.signInWithOtp({
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
    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured.");
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const response = await withAuthTimeout((await getSupabaseClient()).auth.signInWithPassword({
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
    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured.");
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedName = String(displayName || "").trim();
    const response = await withAuthTimeout((await getSupabaseClient()).auth.signUp({
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
    trackProductEvent(response?.data?.session ? "sign_up" : "signup_confirmation_requested", { method: "email", confirmation_required: !response?.data?.session });
    return response;
  }, []);

  const resendConfirmation = useCallback(async (email) => {
    const response = await withAuthTimeout((await getSupabaseClient()).auth.resend({
      type: "signup", email: String(email || "").trim().toLowerCase(),
      options: { emailRedirectTo: getAuthRedirectUrl() },
    }), "Sending the confirmation email");
    if (response.error) throw response.error;
    return response;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const response = await withAuthTimeout((await getSupabaseClient()).auth.signInWithOAuth({
      provider: "google", options: { redirectTo: getAuthRedirectUrl() },
    }), "Opening Google sign-in");
    if (response.error) throw response.error;
    return response;
  }, []);

  const sendPasswordReset = useCallback(async (email) => {
    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured.");
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const redirectTo = typeof window !== "undefined"
      ? `${window.location.origin}/reset-password`
      : undefined;

    const response = await withAuthTimeout((await getSupabaseClient()).auth.resetPasswordForEmail(normalizedEmail, {
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
    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured.");
    }

    const response = await withAuthTimeout((await getSupabaseClient()).auth.updateUser({
      password,
    }), "Updating the password");
    const { data, error } = response;

    if (error) {
      setAuthError(error.message || "We couldn't update your password.");
      throw error;
    }

    setAuthError("");
    setPasswordRecoveryActive(false);
    recoveryRedirectedRef.current = false;
    setPendingRecoverySession(null);
    const restored = await (await getSupabaseClient()).auth.getSession();
    setSession(restored.data?.session || null);
    return data.user;
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) {
      return;
    }

    const { error } = await (await getSupabaseClient()).auth.signOut();
    if (error) {
      setAuthError(error.message || "We couldn't log you out right now.");
      throw error;
    }

    setAuthError("");
    setLastMagicLinkEmail("");
    setPasswordRecoveryActive(false);
  }, []);

  const updateDisplayName = useCallback(async (displayName) => {
    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured.");
    }

    const normalizedName = String(displayName || "").trim();
    const { data, error } = await (await getSupabaseClient()).auth.updateUser({
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
    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured.");
    }

    const client = await getSupabaseClient();
    const { data: { session: currentSession } } = await client.auth.getSession();
    const accessToken = currentSession?.access_token;
    if (!accessToken) {
      throw new Error("No active session.");
    }

    const apiBaseUrl = API_BASE_URL;
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

    await (await getSupabaseClient()).auth.signOut();
    setAuthError("");
    setLastMagicLinkEmail("");
    setPasswordRecoveryActive(false);
    closeAuthPrompt();
  }, [closeAuthPrompt]);

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
      authNotice,
      clearAuthNotice: () => setAuthNotice(null),
      lastMagicLinkEmail,
      passwordRecoveryActive,
      recoverySession: pendingRecoverySession,
      sendMagicLink,
      signInWithPassword,
      signUpWithPassword,
      resendConfirmation,
      signInWithGoogle,
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
      authNotice,
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
      resendConfirmation,
      signInWithGoogle,
      updateDisplayName,
      updatePassword,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
