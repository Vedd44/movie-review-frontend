import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL, getMoviePath } from "../discovery";
import { dedupeIds, normalizePickPayload } from "../reelbotSession";
import { useAskReelbotContext } from "../context/AskReelbotContext";
import useTasteProfile from "../hooks/useTasteProfile";
import TasteActionBar from "./TasteActionBar";
import { getPromptCategory, trackProductEvent } from "../analytics";
import { classifyAskIntent, getAskLoadingCopy, isRecommendationIntent } from "../askIntent";
import { addHistoryStatus, createAskConversation } from "../askConversation";
import { pickLoadingQuote } from "../reelbotLoadingQuotes";

const GENERAL_ACTIONS = [
  ["Find me something to watch", "something worth watching tonight"],
  ["Pick for date night", "a good date-night movie"],
  ["Keep it under 100 minutes", "something good under 100 minutes"],
  ["Something easy tonight", "an easy movie for tonight"],
  ["Surprise me", ""],
];

export const getPanelConfig = (context = {}) => {
  if (context.page === "movie_detail") {
    const movieTitle = context.movie?.title || context.movieTitle || "this movie";
    return {
      heading: `Ask about ${movieTitle}`,
      prompt: "What do you want to know?",
      actions: [
        ["Something like this", "something like this"],
        ["Something lighter", "something like this, but lighter"],
        ["Something less intense", "something like this, but less intense"],
        ["A more modern alternative", "a more modern alternative to this"],
        ["What should I watch after this?", "what should I watch after this?"],
        ["Good for a group", "is this good for a group?"],
      ],
    };
  }

  if (context.page === "browse") {
    return {
      heading: "Ask ReelBot about these movies",
      prompt: context.visibleMovieIds?.length ? "Pick from these results" : "What are you looking for?",
      actions: [
        ["Best crowd-pleaser", "the best crowd-pleaser from these movies"],
        ["Shortest good option", "the shortest good option from these movies"],
        ["Something lighter", "something lighter from these movies"],
        ["Just pick one", "pick the best movie from these results"],
      ],
    };
  }

  if (context.page === "now_playing") {
    return {
      heading: "Pick from what’s in theaters",
      prompt: "What works for tonight?",
      actions: [
        ["Best date-night option", "the best date-night option in theaters"],
        ["Best crowd-pleaser", "the best crowd-pleaser in theaters"],
        ["Under 2 hours", "a good movie in theaters under two hours"],
        ["Nothing too heavy", "a movie in theaters that is not too heavy"],
        ["Just pick one", "pick one movie in theaters"],
      ],
    };
  }

  if (context.page === "my_movies") {
    return {
      heading: "Pick from My Movies",
      prompt: "Choose something I already saved",
      actions: [
        ["Something I saved", "pick something I saved but have not watched"],
        ["Shortest good option", "the shortest good option from my saved movies"],
        ["Something easy tonight", "something easy tonight from my saved movies"],
        ["Surprise me from my list", "surprise me from my saved movies"],
      ],
    };
  }

  if (context.page === "recommendation") {
    return {
      heading: "Refine this pick",
      prompt: "Adjust this pick without starting over",
      actions: [
        ["Something lighter", `${context.originalPrompt || "this request"}, but lighter`],
        ["Something shorter", `${context.originalPrompt || "this request"}, but shorter`],
        ["More like this", `something more like ${context.currentPick?.title || "this pick"}`],
        ["Different angle", `${context.originalPrompt || "the same request"}, from a different angle`],
      ],
    };
  }

  return { heading: "Ask ReelBot", prompt: "What are you looking for?", actions: GENERAL_ACTIONS };
};

function AskReelbotLayer() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pageContext } = useAskReelbotContext();
  const { behavioralMemory, getPickExcludedIds } = useTasteProfile();
  const inputRef = useRef(null);
  const triggerRef = useRef(null);
  const sheetRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [lastTurn, setLastTurn] = useState(null);
  const [excludedIds, setExcludedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingIntent, setLoadingIntent] = useState("");
  const [loadingQuote, setLoadingQuote] = useState(null);
  const [error, setError] = useState("");

  const fallbackContext = useMemo(() => ({
    page: location.pathname === "/now-playing" ? "now_playing" : "general",
  }), [location.pathname]);
  const context = pageContext || fallbackContext;
  const config = useMemo(() => getPanelConfig(context), [context]);
  const [conversation, setConversation] = useState(() => createAskConversation(pageContext || fallbackContext));
  const contextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    setConversation((current) => {
      if (!current.lastUserMessage) return createAskConversation(context);
      return {
        ...current,
        pageContext: context.page || current.pageContext,
        anchorMovie: context.movie || context.currentPick || current.anchorMovie,
        activeRequest: current.activeRequest || context.originalPrompt || "",
      };
    });
  }, [context]);

  useEffect(() => {
    const handleOpen = (event) => {
      setOpen(true);
      setDraft(String(event.detail?.prompt || ""));
      setResult(null);
      setAnswerResult(null);
      setError("");
      trackProductEvent("ask_reelbot_opened", { page: window.location.pathname });
    };
    window.addEventListener("reelbot:open-ask", handleOpen);
    return () => window.removeEventListener("reelbot:open-ask", handleOpen);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const triggerElement = triggerRef.current;
    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab" || !sheetRef.current) return;
      const focusable = Array.from(sheetRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
      window.setTimeout(() => triggerElement?.focus(), 0);
    };
  }, [open]);

  useEffect(() => {
    setResult(null);
    setAnswerResult(null);
    setLastTurn(null);
    setError("");
    setExcludedIds([]);
    setConversation(createAskConversation(contextRef.current));
  }, [location.pathname, location.search]);

  const requestPick = async (prompt, options = {}) => {
    const normalizedPrompt = String(prompt || "").trim();
    const nextPreferences = { prompt: normalizedPrompt };
    const requestExcludedIds = dedupeIds([
      ...getPickExcludedIds(nextPreferences, excludedIds),
      ...(options.extraExcludedIds || []),
    ]);

    if (context.page === "my_movies" && !(context.savedMovieIds || context.candidateMovieIds || []).length) {
      setError("Save a few movies first, then ReelBot can choose from them.");
      return;
    }

    const requestConversation = result && /^\s*(?:not that one|no,? not that|skip)/i.test(normalizedPrompt)
      ? addHistoryStatus(conversation, result.primary, "rejected")
      : conversation;
    const predictedIntent = classifyAskIntent({ prompt: normalizedPrompt, context, conversation: requestConversation });
    setLoadingIntent(predictedIntent);
    setLoadingQuote(isRecommendationIntent(predictedIntent) ? pickLoadingQuote() : null);
    setLoading(true);
    setError("");
    const startedAt = Date.now();
    trackProductEvent("ask_reelbot_submitted", { page: context.page || "general", prompt_category: getPromptCategory(normalizedPrompt) });
    try {
      const response = await axios.post(`${API_BASE_URL}/reelbot/ask`, {
        prompt: normalizedPrompt,
        trigger: "user_click",
        request_mode: options.isSwap ? "swap" : "initial",
        behavioral_memory: behavioralMemory,
        page_context: {
          ...context,
          movie: context.movie || (context.movieId ? { id: context.movieId, title: context.movieTitle } : undefined),
          activeConstraints: context.activeConstraints || { includeTheatrical: Boolean(context.includeTheatrical) },
          savedMovieIds: context.savedMovieIds || context.candidateMovieIds || [],
          excludedMovieIds: requestExcludedIds,
        },
        previous_turn: lastTurn,
        conversation_state: requestConversation,
      }, { headers: { "X-ReelBot-Trigger": "user_click" } });
      if (response.data?.conversation_state) setConversation(response.data.conversation_state);
      if (response.data?.kind === "answer") {
        setAnswerResult(response.data);
        setResult(null);
        setLastTurn({ prompt: normalizedPrompt, intent: response.data.intent, answer: response.data.answer });
        trackProductEvent("ask_reelbot_intent", { intent: response.data.intent, page: context.page || "general" });
        trackProductEvent("ask_reelbot_result", { kind: "answer", latency_ms: response.data.latency_ms || Date.now() - startedAt });
        return;
      }
      const payload = normalizePickPayload(response.data?.recommendation, requestExcludedIds);
      if (!payload?.primary) throw new Error("no_pick");
      setAnswerResult(null);
      setResult(payload);
      setLastTurn({ prompt: normalizedPrompt, intent: response.data?.intent, movie_id: payload.primary.id, movie_title: payload.primary.title });
      trackProductEvent("ask_reelbot_intent", { intent: response.data?.intent || "UNKNOWN", page: context.page || "general" });
      trackProductEvent("ask_reelbot_result", { kind: "recommendation", latency_ms: response.data?.latency_ms || Date.now() - startedAt });
      setExcludedIds((current) => dedupeIds([...current, payload.primary.id]));
    } catch (requestError) {
      trackProductEvent("ask_reelbot_failed", { page: context.page || "general", latency_ms: Date.now() - startedAt });
      setError(requestError?.message === "no_pick" ? "Nothing great matched that exactly. Try loosening one detail." : "ReelBot hit a snag. Try that again.");
    } finally {
      setLoading(false);
      setLoadingIntent("");
      setLoadingQuote(null);
    }
  };

  const submitDraft = (event) => {
    event?.preventDefault();
    requestPick(draft);
  };

  const closePanel = () => setOpen(false);
  const rationaleLines = result?.rationale?.whyRecommended || result?.rationale?.why_this_works || [];
  const resultReason = rationaleLines.filter(Boolean).slice(0, 2).join(" ") || result?.primary?.reason || result?.summary;
  const loadingCopy = getAskLoadingCopy(loadingIntent);
  const answerMovieTitle = answerResult?.conversation_state?.anchorMovie?.title || conversation.anchorMovie?.title || context.movie?.title || context.movieTitle || "this movie";

  return (
    <>
      <button ref={triggerRef} type="button" className="ask-reelbot-trigger" onClick={() => { setOpen(true); trackProductEvent("ask_reelbot_opened", { page: context.page || "general" }); }} aria-haspopup="dialog">
        <span aria-hidden="true">✦</span> Ask ReelBot
      </button>
      {open ? (
        <div className="ask-reelbot-backdrop" role="presentation" onMouseDown={closePanel}>
          <section ref={sheetRef} className="ask-reelbot-sheet" role="dialog" aria-modal="true" aria-labelledby="ask-reelbot-sheet-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="ask-reelbot-sheet-head">
              <div>
                <div className="detail-description-label">Decision help</div>
                <h2 id="ask-reelbot-sheet-title">{config.heading}</h2>
                {!result && !answerResult ? <p>{config.prompt}</p> : null}
              </div>
              <button type="button" className="ask-reelbot-close" onClick={closePanel} aria-label="Close Ask ReelBot">×</button>
            </header>

            {!result && !answerResult ? (
              <div className="ask-reelbot-start">
                <div className="ask-reelbot-suggestions">
                  {config.actions.map(([label, prompt]) => (
                    <button key={label} type="button" onClick={() => { setDraft(prompt); requestPick(prompt); }} disabled={loading}>{label}</button>
                  ))}
                </div>
              </div>
            ) : null}
            {answerResult ? (
              <article className="ask-reelbot-answer ask-reelbot-answer--direct">
                <div className="ask-reelbot-answer-label">About {answerMovieTitle}</div>
                <p className="ask-reelbot-direct-copy">{answerResult.answer}</p>
                <div className="ask-reelbot-answer-actions">
                  <button type="button" className="reelbot-inline-button" onClick={() => { setDraft("something gentler than this"); requestPick("something gentler than this"); }}>Something gentler</button>
                  <button type="button" className="reelbot-inline-button" onClick={() => { setDraft("find something like this"); requestPick("find something like this"); }}>Find something like this</button>
                </div>
              </article>
            ) : result ? (
              <article className="ask-reelbot-answer">
                <div className="ask-reelbot-answer-label">Your pick</div>
                <div className="ask-reelbot-answer-main">
                  {result.primary.poster_path ? <img src={`https://image.tmdb.org/t/p/w185${result.primary.poster_path}`} alt="" loading="lazy" decoding="async" /> : null}
                  <div>
                    <h3>{result.primary.title}</h3>
                    <p>{resultReason}</p>
                  </div>
                </div>
                <div className="ask-reelbot-answer-actions">
                  <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" onClick={() => { closePanel(); navigate(getMoviePath(result.primary)); }}>View movie</button>
                  <button type="button" className="reelbot-inline-button" disabled={loading} onClick={() => requestPick("Another one", { isSwap: true, extraExcludedIds: [result.primary.id] })}>{loading ? "Finding your pick…" : "Another option"}</button>
                  <TasteActionBar movie={result.primary} compact showSeenAction={false} showSkipAction={false} showVibeAction={false} />
                </div>
              </article>
            ) : null}
            <form className="ask-reelbot-form" onSubmit={submitDraft}>
              <input ref={inputRef} value={draft} maxLength={500} onChange={(event) => setDraft(event.target.value)} placeholder={answerResult || result ? "Ask a follow-up…" : "Ask ReelBot…"} aria-label="Ask ReelBot" />
              <button type="submit" disabled={loading || !draft.trim()}>{loading ? loadingCopy : "Ask"}</button>
            </form>
            {loading ? (
              <div className="ask-reelbot-status" role="status">
                <div>{loadingCopy}</div>
                {isRecommendationIntent(loadingIntent) && loadingQuote ? (
                  <div className="ask-reelbot-loading-quote">
                    <q>{loadingQuote.quote}</q>
                    <span>{loadingQuote.movie}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
            {error ? <div className="ask-reelbot-status ask-reelbot-status--error" role="alert">{error}</div> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

export default AskReelbotLayer;
