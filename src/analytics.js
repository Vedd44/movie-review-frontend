import { hasAnalyticsConsent } from './cookieConsent';
import { recordProductTelemetry } from './productTelemetry';
const cleanProperties = (properties = {}) => Object.fromEntries(
  Object.entries(properties).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
);

export const getPromptCategory = (prompt = "") => {
  const value = String(prompt || "").toLowerCase();
  if (!value.trim()) return "surprise";
  if (/under|minutes|hour|runtime|short/.test(value)) return "runtime";
  if (/kid|child|family|toddler/.test(value)) return "family";
  if (/like|similar|after this/.test(value)) return "similarity";
  if (/lighter|darker|scary|intense|easy|sad|funny/.test(value)) return "tone";
  return "general";
};

export const trackProductEvent = (name, properties = {}) => {
  const safeProperties = cleanProperties(properties);
  // Local movie personalization remains functional regardless of analytics consent.
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent("reelbot:analytics", { detail: { name, properties: safeProperties } }));
  if (!hasAnalyticsConsent()) return;
  recordProductTelemetry(name, safeProperties);

  if (typeof window !== "undefined") {
    // GA4 is loaded only after explicit analytics consent. Calling gtag here means the
    // same product event names used by ReelBot's internal/Vercel analytics also
    // reach GA4 without duplicating event logic in GTM.
    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", name, safeProperties);
      } else if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push({ event: name, ...safeProperties });
      }
    } catch (error) {
      // Analytics must never interrupt a product action.
    }


  }

  if (process.env.NODE_ENV === "production") {
    try {
      window.va?.("event", { name, data: safeProperties });
    } catch (error) {
      // Analytics must never interrupt a product action.
    }
  }
};
