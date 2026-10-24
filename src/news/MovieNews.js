import { Link } from 'react-router-dom';
import { usePageMetadata } from '../seo';
import useMovieNews from './useMovieNews';
import { isStale, isFreshStory } from './policy';
import './movieNews.css';

function formattedDate(value) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}
export function NewsCard({ story, compact = false }) {
  const Heading = compact ? 'h3' : 'h2';
  return <article className={`movie-news-story${compact ? ' movie-news-story--compact' : ''}`}>
    <div className="movie-news-meta"><span>{story.sourceName}</span><span aria-hidden="true">·</span>
      <time dateTime={story.publishedAt}>{formattedDate(story.publishedAt)}</time>
    </div>
    <Heading><a href={story.sourceUrl} target="_blank" rel="noopener noreferrer">{story.headline}<span className="sr-only"> (opens in a new tab)</span></a></Heading>
    {story.author && <p className="movie-news-attribution">By {story.author}</p>}
    <p className="movie-news-summary">{story.summary}</p>
    {story.take && <div className="movie-news-take"><span className="movie-news-take-label">ReelBot’s Take</span><p>{story.take}</p></div>}
    <div className="movie-news-actions"><a href={story.sourceUrl} target="_blank" rel="noopener noreferrer">Read at {story.sourceName}<span className="sr-only"> (opens in a new tab)</span></a></div>
  </article>;
}
export function MovieNewsHome() {
  const news = useMovieNews();
  const homeItems = (news.snapshot?.items || []).filter(story => isFreshStory(story));
  if (news.status !== 'ready' || !homeItems.length || isStale(news.snapshot)) return null;
  return <section className="movie-news-home" aria-labelledby="movie-news-home-title">
    <div className="movie-news-home-header"><h2 id="movie-news-home-title">Movie news</h2><Link to="/news">All movie news <span aria-hidden="true">→</span></Link></div>
    <div className="movie-news-home-grid">{homeItems.slice(0, 3).map(story => <NewsCard key={story.id} story={story} compact />)}</div>
  </section>;
}
export default function MovieNews() {
  const news = useMovieNews();
  usePageMetadata({ title: 'Movie news | ReelBot', description: 'Movie headlines from the film press, with ReelBot’s Take.', path: '/news', robots: 'noindex,follow' });
  const items = (news.snapshot?.items || []).slice(0, 25);
  return <div className="movie-news-page"><div className="container movie-news-shell">
    <header className="movie-news-header"><Link to="/browse" className="movie-news-back">← Find something to watch</Link><h1>Movie news</h1></header>
    {news.status === 'loading' && <div className="movie-news-state" role="status">Loading movie news…</div>}
    {news.status === 'error' && <div className="movie-news-state" role="status"><h2>The news is unavailable right now.</h2><p>You can still browse movies while we get it back.</p><button type="button" onClick={news.retry}>Try again</button></div>}
    {news.status === 'ready' && items.length === 0 && <div className="movie-news-state"><h2>Nothing new to share just yet.</h2><Link to="/collections">Explore movie collections →</Link></div>}
    {news.status === 'ready' && items.length > 0 && <>
      {news.snapshot.updatedAt && <p className="movie-news-updated">Updated {formattedDate(news.snapshot.updatedAt)} · Refreshes every six hours</p>}
      {isStale(news.snapshot) && <p className="movie-news-stale" role="status">This selection has not been updated recently. Check the original source for newer developments.</p>}
      <div className="movie-news-feed">{items.map(story => <NewsCard key={story.id} story={story} />)}</div>
      <p className="movie-news-end">You’re all caught up. <Link to="/browse">Find a movie →</Link></p>
    </>}
  </div></div>;
}
