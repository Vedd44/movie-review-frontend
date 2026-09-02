import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const AskReelbotContext = createContext({
  pageContext: null,
  registerPageContext: () => {},
  unregisterPageContext: () => {},
});

export function AskReelbotProvider({ children }) {
  const [registrations, setRegistrations] = useState([]);

  const registerPageContext = useCallback((id, context) => {
    setRegistrations((current) => [...current.filter((entry) => entry.id !== id), { id, context }]);
  }, []);

  const unregisterPageContext = useCallback((id) => {
    setRegistrations((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const value = useMemo(() => ({
    pageContext: registrations[registrations.length - 1]?.context || null,
    registerPageContext,
    unregisterPageContext,
  }), [registerPageContext, registrations, unregisterPageContext]);

  return <AskReelbotContext.Provider value={value}>{children}</AskReelbotContext.Provider>;
}

export function useAskReelbotPageContext(context) {
  const { registerPageContext, unregisterPageContext } = useContext(AskReelbotContext);
  const registrationId = useRef(`ask-context-${Math.random().toString(36).slice(2)}`);
  const serializedContext = JSON.stringify(context || null);
  const stableContext = useMemo(() => JSON.parse(serializedContext), [serializedContext]);

  useEffect(() => {
    registerPageContext(registrationId.current, stableContext);
    const currentId = registrationId.current;
    return () => unregisterPageContext(currentId);
  }, [registerPageContext, stableContext, unregisterPageContext]);
}

export const useAskReelbotContext = () => useContext(AskReelbotContext);

export const openAskReelbot = (options = {}) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("reelbot:open-ask", { detail: options }));
};
