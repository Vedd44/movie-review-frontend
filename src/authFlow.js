export const getAuthReturn = () => {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const value = key => hash.get(key) || url.searchParams.get(key);
  if (value("error")) return {
    kind: "error",
    view: url.pathname === "/reset-password" ? "forgot-password" : "email-link",
    message: value("error_code") === "otp_expired"
      ? "That email link has expired or has already been used. Request a new link below."
      : "We couldn’t finish signing you in. Try again or use another sign-in option.",
  };
  return value("type") === "signup" ? { kind: "confirmation" } : null;
};

export const authErrorMessage = (error, fallback) => {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  if (code.includes("rate_limit") || message.includes("rate limit") || (message.includes("after") && message.includes("seconds"))) return "Please wait a minute before trying again.";
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) return "Confirm your email before signing in.";
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) return "Incorrect email or password.";
  if (code === "weak_password") return "Use a stronger password with at least 8 characters, including letters and numbers.";
  return fallback;
};
