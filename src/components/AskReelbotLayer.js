import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL, getMoviePath, getRecommendationMovieState, isContextualDetailPath, hasUsefulAskContext } from "../discovery";
import { dedupeIds, normalizePickPayload } from "../reelbotSession";
import { useAskReelbotContext } from "../context/AskReelbotContext";
import useTasteProfile from "../hooks/useTasteProfile";
import TasteActionBar from "./TasteActionBar";
import { getPromptCategory, trackProductEvent } from "../analytics";
import { classifyAskIntent, getAskLoadingCopy } from "../askIntent";
import { addHistoryStatus, createAskConversation } from "../askConversation";

const GENERAL_ACTIONS = [
  ["Find me something to watch", "something worth watching tonight"],
  ["Pick for date night", "a good date-night movie"],
  ["Keep it under 100 minutes", "something good under 100 minutes"],
  ["Something easy tonight", "an easy movie for tonight"],
  ["Surprise me", ""],
];

const MOVIE_ACTIONS = [
  ["Is it scary?", "Is it scary?"],
  ["Is it slow?", "Is it slow?"],
  ["What should I know before watching?", "What should I know before watching?"],
  ["Is it good for a group?", "Is it good for a group?"],
  ["How intense is it?", "How intense is it?"],
  ["Explain the ending", "Explain the ending"],
];

const PERSON_ACTIONS = [
  ["Where should I start?", "Pick a good starting point from this filmography"],
  ["Under two hours", "Pick a movie under two hours from this filmography"],
  ["Something lighter", "Pick something lighter from this filmography"],
];

const REFINEMENT_ACTIONS = [
  ["Something like this", "something like this"],
  ["Something lighter", "something like this, but lighter"],
  ["Something less intense", "something like this, but less intense"],
  ["A more modern alternative", "a more modern alternative to this"],
  ["What should I watch after this?", "what should I watch after this?"],
  ["Good for a group", "is this good for a group?"],
];

export const normalizeAskFollowUps = (value) => (Array.isArray(value) ? value : [])
  .filter((item) => typeof item === "string")
  .map((item) => item.replace(/\s+/g, " ").trim())
  .filter(Boolean)
  .filter((item, index, items) => items.indexOf(item) === index)
  .slice(0, 4);

export const getPanelConfig = (context = {}) => {
  if (context.page === "movie_detail") {
    const movieTitle = context.movie?.title || context.movieTitle || "this movie";
    return {
      heading: `Ask about ${movieTitle}`,
      prompt: "What do you want to know?",
      actions: MOVIE_ACTIONS,
    };
  }

  if (context.page === "recommendation") {
    return {
      heading: "Refine this pick",
      prompt: "Adjust this pick without starting over",
      actions: REFINEMENT_ACTIONS,
    };
  }

  if (context.page === "person") {
    const personName = context.person?.name || context.personName || "this person";
    return {
      heading: `Choose a ${personName} movie`,
      prompt: "Choose from the films shown on this page.",
      actions: PERSON_ACTIONS,
    };
  }

  if (context.page === "collection") {
    const title = context.collection?.title || "this collection";
    return {
      heading: `Pick from ${title}`,
      prompt: `One pick from these ${context.visibleMovieIds?.length || 0} movies.`,
      actions: [
        ["Just pick one", context.collection?.prompt || `pick one movie from ${title}`],
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
      prompt: "Choose from your saved movies",
      actions: [
        ["Pick for me", "choose one movie from my saved list that I have not watched"],
        ["Shortest", "choose the shortest good movie from my saved list that I have not watched"],
        ["Easy watch", "choose an easy-to-watch movie from my saved list that I have not watched"],
        ["Surprise me", "surprise me with one movie from my saved list that I have not watched"],
      ],
    };
  }

  return { heading: "Ask ReelBot", prompt: "What are you looking for?", actions: GENERAL_ACTIONS };
};

function AskReelbotLayer() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pageContext } = useAskReelbotContext();
  const { behavioralMemory, getPickExcludedIds, actions: tasteActions } = useTasteProfile();
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
  const [error, setError] = useState("");
  const requestController = useRef(null);
  const requestVersion = useRef(0);

  const fallbackContext = useMemo(() => ({
    page: location.pathname === "/now-playing" ? "now_playing" : "general",
  }), [location.pathname]);
  const context = pageContext || fallbackContext;
  const config = useMemo(() => getPanelConfig(context), [context]);
  const [conversation, setConversation] = useState(() => createAskConversation(pageContext || fallbackContext));
  const contextRef = useRef(context);
  const requestPickRef = useRef(null);
  const previousContextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    const previousContext = previousContextRef.current;
    if (previousContext?.currentPick?.id && !context.currentPick?.id && context.page === "home") {
      setResult(null);
      setAnswerResult(null);
      setLastTurn(null);
      setExcludedIds([]);
      setError("");
      setConversation(createAskConversation(context));
      previousContextRef.current = context;
      return;
    }

    previousContextRef.current = context;
    setConversation((current) => {
      if (!current.lastUserMessage) return createAskConversation(context);
      return {
        ...current,
        pageContext: context.page || current.pageContext,
        anchorMovie: current.recommendationHistory?.length ? current.anchorMovie : (context.movie || context.currentPick || current.anchorMovie),
        activeRequest: current.activeRequest || context.originalPrompt || "",
      };
    });
  }, [context]);

  useEffect(() => {
    const handleOpen = (event) => {
      requestController.current?.abort();
      requestVersion.current += 1;
      setLoading(false);
      setConversation(createAskConversation(contextRef.current));
      setLastTurn(null);
      setExcludedIds([]);
      setOpen(true);
      setDraft(String(event.detail?.prompt || ""));
      setResult(null);
      setAnswerResult(null);
      setError("");
      trackProductEvent("ask_reelbot_opened", { page: window.location.pathname });
      if (event.detail?.autoPick && contextRef.current?.page === "collection") {
        const collection = contextRef.current.collection;
        window.setTimeout(() => requestPickRef.current?.(collection?.prompt || `pick one movie from ${collection?.title || "this collection"}`), 0);
      }
    };
    window.addEventListener("reelbot:open-ask", handleOpen);
    return () => window.removeEventListener("reelbot:open-ask", handleOpen);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const triggerElement = triggerRef.current;
    const handleEscape = (event) => {
      if (event.key === "Escape") { requestController.current?.abort(); requestVersion.current += 1; setLoading(false); setOpen(false); }
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
    requestController.current?.abort();
    requestVersion.current += 1;
    setOpen(false);
    setLoading(false);
    setResult(null);
    setAnswerResult(null);
    setLastTurn(null);
    setError("");
    setExcludedIds([]);
    setConversation(createAskConversation(contextRef.current));
  }, [location.pathname, location.search]);

  const requestPick = async (prompt, options = {}) => {
    const normalizedPrompt = String(prompt || "").trim();
    if (!normalizedPrompt || loading) return;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const version = ++requestVersion.current;
    const nextPreferences = { prompt: normalizedPrompt };
    const requestExcludedIds = dedupeIds([
      ...getPickExcludedIds(nextPreferences, excludedIds),
      ...(options.extraExcludedIds || []),
    ]);

    if (context.page === "my_movies" && !(context.savedMovieIds || context.candidateMovieIds || []).length) {
      setError("Save a few movies first, then ReelBot can choose from them.");
      return;
    }

    // The normalized prompt is captured in the request payload and
    // conversation state below. Clear only the visible composer once the
    // request is accepted, leaving validation failures untouched.
    setDraft("");
    const requestConversation = result && /^\s*(?:not that one|no,? not that|skip)/i.test(normalizedPrompt)
      ? addHistoryStatus(conversation, result.primary, "rejected")
      : conversation;
    const predictedIntent = classifyAskIntent({ prompt: normalizedPrompt, context, conversation: requestConversation });
    setLoadingIntent(predictedIntent);
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
      }, { headers: { "X-ReelBot-Trigger": "user_click" }, signal: controller.signal, timeout: 90000 });
      if (controller.signal.aborted || version !== requestVersion.current) return;
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
      if (response.data?.recommendation?.user_message && !payload?.primary) {
        setResult(null);
        setAnswerResult(null);
        setError(response.data.recommendation.user_message);
        return;
      }
      if (!payload?.primary) throw new Error("no_pick");
      setAnswerResult(null);
      setResult(payload);
      setLastTurn({ prompt: normalizedPrompt, intent: response.data?.intent, movie_id: payload.primary.id, movie_title: payload.primary.title });
      void tasteActions.recordPickResult({
        prompt: normalizedPrompt,
        source: "ask_reelbot",
        view: context.activeFilters?.view || "popular",
        mood: context.activeFilters?.mood || "all",
        runtime: context.activeFilters?.runtime || "any",
        genre: context.activeFilters?.genre || "all",
      }, payload).catch(() => {});
      trackProductEvent("ask_reelbot_intent", { intent: response.data?.intent || "UNKNOWN", page: context.page || "general" });
      trackProductEvent("ask_reelbot_result", { kind: "recommendation", latency_ms: response.data?.latency_ms || Date.now() - startedAt });
      setExcludedIds((current) => dedupeIds([...current, payload.primary.id]));
    } catch (requestError) {
      if (controller.signal.aborted || version !== requestVersion.current) return;
      trackProductEvent("ask_reelbot_failed", { page: context.page || "general", latency_ms: Date.now() - startedAt });
      setError(requestError?.message === "no_pick" ? "Nothing great matched that exactly. Try loosening one detail." : "ReelBot hit a snag. Try that again.");
    } finally {
      if (version === requestVersion.current) { setLoading(false); setLoadingIntent(""); }
    }
  };


  requestPickRef.current = requestPick;

  const submitDraft = (event) => {
    event?.preventDefault();
    requestPick(draft);
  };

  const closePanel = () => { requestController.current?.abort(); requestVersion.current += 1; setLoading(false); setOpen(false); };
  useEffect(() => () => { requestController.current?.abort(); }, []);
  const isCollection = context.page === "collection";
  const rationaleLines = result?.rationale?.whyRecommended || result?.rationale?.why_this_works || [];
  const resultReason = result?.rationale?.primary_reason || result?.primary?.reason || rationaleLines.filter(Boolean).slice(0, 2).join(" ") || result?.summary;
  const loadingCopy = getAskLoadingCopy(loadingIntent);
  const answerMovieTitle = answerResult?.conversation_state?.anchorMovie?.title || conversation.anchorMovie?.title || context.movie?.title || context.movieTitle || "this movie";
  const contextualFollowUps = normalizeAskFollowUps(answerResult?.follow_ups);
  const triggerLabel = isCollection ? "Pick for me" : context.page === "person" ? "Help me choose" : "Ask ReelBot";
  const [pastHomeHero, setPastHomeHero] = useState(location.pathname !== "/");

  useEffect(() => {
    if (location.pathname !== "/") { setPastHomeHero(true); return undefined; }
    const hero = document.getElementById("pick-for-me");
    if (!hero) { setPastHomeHero(false); return undefined; }
    const update = () => setPastHomeHero(window.scrollY > Math.max(140, hero.offsetHeight * 0.28));
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [location.pathname]);

  const openPanel = () => {
    setConversation(createAskConversation(context));
    setLastTurn(null);
    setExcludedIds([]);
    setOpen(true);
    setDraft("");
    setResult(null);
    setAnswerResult(null);
    setError("");
    trackProductEvent("ask_reelbot_opened", { page: context.page || "general" });
    if (isCollection) {
      window.setTimeout(() => requestPick(context.collection?.prompt || `pick one movie from ${context.collection?.title || "this collection"}`), 0);
    }
  };

  return (
    <>
      {isContextualDetailPath(location.pathname) && hasUsefulAskContext(context) ? <button ref={triggerRef} type="button" className={`ask-reelbot-trigger${isCollection ? " ask-reelbot-trigger--collection" : ""}${pastHomeHero ? "" : " is-hero-hidden"}`} onClick={openPanel} aria-haspopup="dialog">
        {triggerLabel}
      </button> : null}
      {open ? (
        <div className="ask-reelbot-backdrop" role="presentation" onMouseDown={closePanel}>
          <section ref={sheetRef} className="ask-reelbot-sheet" role="dialog" aria-modal="true" aria-labelledby="ask-reelbot-sheet-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="ask-reelbot-sheet-head">
              <div>
                <div className="detail-description-label reelbot-assistant-label"><img src="/brand/reelbot-icon.svg" alt="" aria-hidden="true" width="20" height="24" />{isCollection ? "ReelBot Collection Pick" : "Ask ReelBot"}</div>
                <h2 id="ask-reelbot-sheet-title">{config.heading}</h2>
                {!result && !answerResult ? <p>{config.prompt}</p> : null}
              </div>
              <button type="button" className="ask-reelbot-close" onClick={closePanel} aria-label="Close Ask ReelBot">×</button>
            </header>

            {!isCollection && !result && !answerResult ? (
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
                  {contextualFollowUps.map((followUp) => (
                    <button key={followUp} type="button" className="reelbot-inline-button" onClick={() => requestPick(followUp)}>{followUp}</button>
                  ))}
                </div>
              </article>
            ) : result ? (
              <article className="ask-reelbot-answer">
                <div className="ask-reelbot-answer-label">Your pick</div>
                <div className="ask-reelbot-answer-main">
                  {result.primary.poster_path ? <img src={`https://image.tmdb.org/t/p/w185${result.primary.poster_path}`} alt="" loading="lazy" decoding="async" /> : null}
                  <div>
                    <h3>{result.primary.title}</h3>
                    {resultReason ? <p>{resultReason}</p> : <p>Open the movie for its story and viewing options.</p>}
                  </div>
                </div>
                <div className="ask-reelbot-answer-actions">
                  <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" onClick={() => { closePanel(); navigate(getMoviePath(result.primary), { state: getRecommendationMovieState(result.primary) }); }}>View movie</button>
                  <button type="button" className="reelbot-inline-button" disabled={loading} onClick={() => requestPick("Another one", { isSwap: true, extraExcludedIds: [result.primary.id] })}>{loading ? "Finding your pick…" : "Another option"}</button>
                  <TasteActionBar movie={result.primary} compact showSeenAction={false} showSkipAction={false} showVibeAction={false} />
                </div>
              </article>
            ) : null}
            {!isCollection ? (
              <form className="ask-reelbot-form" onSubmit={submitDraft}>
                <input ref={inputRef} value={draft} maxLength={500} onChange={(event) => setDraft(event.target.value)} placeholder={answerResult || result ? "Ask a follow-up…" : "Ask ReelBot…"} aria-label="Ask ReelBot" />
                <button type="submit" disabled={loading || !draft.trim()}>{loading ? loadingCopy : "Ask"}</button>
              </form>
            ) : null}
            {loading ? (
              <div className={`ask-reelbot-status ask-reelbot-status--loading${isCollection ? " ask-reelbot-status--collection" : ""}`} role="status" aria-live="polite">
                <div className="ask-reelbot-status-progress">
                  <span className="ask-reelbot-spinner" aria-hidden="true" />
                  <div>
                    <strong>{isCollection ? "Finding your pick" : loadingCopy}</strong>
                    <span>{isCollection ? `Choosing from the ${context.visibleMovieIds?.length || 0} movies in ${context.collection?.title || "this collection"}…` : ""}</span>
                  </div>
                </div>

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
