import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL, getMoviePath, getReleaseYear } from "../discovery";
import { trackProductEvent } from "../analytics";

const SEARCH_DELAY_MS = 180;

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function GlobalMovieSearch() {
  const navigate = useNavigate();
  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const closeSearch = (restoreFocus = true) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setError("");
    setActiveIndex(-1);
    if (restoreFocus) {
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    }
  };

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        trackProductEvent("movie_search_opened", { shortcut: true });
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        closeSearch();
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]'));
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
    window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!open || normalizedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      setError("");
      setActiveIndex(-1);
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setLoading(true);
      setError("");
      trackProductEvent("movie_search_submitted", { query_length: normalizedQuery.length });
      axios
        .get(`${API_BASE_URL}/search?query=${encodeURIComponent(normalizedQuery)}`, { signal: controller.signal })
        .then((response) => {
          setResults((response.data?.results || []).slice(0, 7));
          setActiveIndex(-1);
        })
        .catch((requestError) => {
          if (requestError?.code !== "ERR_CANCELED") {
            setResults([]);
            setError("Search is unavailable right now.");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, SEARCH_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [open, query]);

  const openMovie = (movie) => {
    if (!movie?.id) return;
    closeSearch(false);
    setQuery("");
    trackProductEvent("movie_search_result_clicked", { movie_id: Number(movie.id), result_index: results.findIndex((item) => item.id === movie.id) });
    navigate(getMoviePath(movie));
  };

  const handleInputKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(results.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(-1, current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        openMovie(results[activeIndex]);
      } else if (query.trim()) {
        closeSearch(false);
        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="global-search-trigger"
        onClick={() => { setOpen(true); trackProductEvent("movie_search_opened", { shortcut: false }); }}
        aria-label="Search movies"
        aria-haspopup="dialog"
      >
        <SearchIcon />
        <span className="global-search-trigger-label">Search</span>
        <span className="global-search-shortcut" aria-hidden="true">⌘K</span>
      </button>

      {open ? (
        <div className="global-search-backdrop" role="presentation" onMouseDown={() => closeSearch()}>
          <section
            ref={panelRef}
            className="global-search-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="global-search-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="global-search-head">
              <div>
                <div className="detail-description-label">Movie search</div>
                <h2 id="global-search-title">Find a movie</h2>
              </div>
              <button type="button" className="global-search-close" onClick={() => closeSearch()} aria-label="Close movie search">×</button>
            </div>

            <div className="global-search-input-shell">
              <SearchIcon />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search movie titles"
                aria-label="Search movie titles"
                aria-controls="global-search-results"
                aria-activedescendant={activeIndex >= 0 ? `global-search-result-${activeIndex}` : undefined}
                autoComplete="off"
              />
              {query ? <button type="button" className="global-search-clear" onClick={() => setQuery("")}>Clear</button> : null}
            </div>

            <div id="global-search-results" className="global-search-results" role="listbox" aria-label="Movie results">
              {loading ? <div className="global-search-status">Searching…</div> : null}
              {!loading && error ? <div className="global-search-status global-search-status--error">{error}</div> : null}
              {!loading && !error && query.trim().length < 2 ? <div className="global-search-status">Type at least two characters.</div> : null}
              {!loading && !error && query.trim().length >= 2 && !results.length ? <div className="global-search-status">No matching movies found.</div> : null}
              {!loading && !error ? results.map((movie, index) => (
                <button
                  key={movie.id}
                  id={`global-search-result-${index}`}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  className={`global-search-result${activeIndex === index ? " is-active" : ""}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => openMovie(movie)}
                >
                  {movie.poster_path ? <img src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`} alt="" loading="lazy" decoding="async" /> : <span className="global-search-poster-placeholder" aria-hidden="true" />}
                  <span className="global-search-result-copy">
                    <strong>{movie.title}</strong>
                    <span>{getReleaseYear(movie.release_date) || "Release date unavailable"}</span>
                  </span>
                  <span className="global-search-open-label">Open</span>
                </button>
              )) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

export default GlobalMovieSearch;
