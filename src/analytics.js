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
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("reelbot:analytics", { detail: { name, properties: safeProperties } }));
  }
  if (process.env.NODE_ENV === "production") {
    try {
      window.va?.("event", { name, data: safeProperties });
    } catch (error) {
      // Analytics must never interrupt a product action.
    }
  }
};
