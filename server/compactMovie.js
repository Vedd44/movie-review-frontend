// Collections need decision facts, not each title's reviews, similar films,
// provider lists and trailer payload in the shared homepage JavaScript bundle.
const FIELDS = ['id','title','original_title','canonical_slug','release_date','release_year','poster_path','runtime','rating','vote_average','vote_count','genre_names','genre_ids','director_credit','top_cast_credits'];
function compactMovie(movie) { return Object.fromEntries(FIELDS.filter(key=>movie[key] !== undefined).map(key=>[key,movie[key]])); }
module.exports = {compactMovie};
