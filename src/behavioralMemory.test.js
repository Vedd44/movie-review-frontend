import {buildBehavioralMemory, scoreMovieForBehavioralMemory} from './behavioralMemory';
const movie = id => ({id, title:`Movie ${id}`, genre_ids:[10749,35], runtime:110});
test('one save, Seen and exploration never become likes or tone/pace preferences', () => {
 const memory=buildBehavioralMemory({profile:{watchlist:[movie(1)],seen:[movie(2)],recentMovies:[movie(3)]},interactions:['save','seen','detail_view','provider_click','swap_used'].map(type=>({type,movie:movie(4)}))});
 expect(memory.preferredGenres).toEqual({});
 expect(memory.tonePreferences).toEqual({});
 expect(memory.pacePreferences).toEqual({});
 expect(memory.userProfile.likedGenres).toEqual([]);
 expect(memory.seenMovieIds).toEqual([2]);
 expect(memory.savedMovieIds).toEqual([1]);
 expect(scoreMovieForBehavioralMemory(movie(5),memory).score).toBe(0);
});
test('distinct repeated saves add modest interest without double counting events or assigning likes',()=>{
 const memory=buildBehavioralMemory({profile:{watchlist:[movie(1),movie(1),movie(2),movie(3)]},interactions:[{type:'save',movie:movie(3)}]});
 expect(memory.preferredGenres[10749]).toBe(0.4);
 expect(memory.userProfile.likedGenres).toEqual([]);
 expect(scoreMovieForBehavioralMemory(movie(5),memory).score).toBeLessThan(3);
});
test('Not interested excludes only that title; Seen is history, not a dislike',()=>{
 const memory=buildBehavioralMemory({profile:{skipped:[movie(1)],seen:[movie(2)]}});
 expect(memory.avoidedGenres).toEqual({});
 expect(scoreMovieForBehavioralMemory(movie(1),memory).score).toBe(-1000);
 expect(scoreMovieForBehavioralMemory(movie(2),memory).score).toBeLessThan(0);
 expect(scoreMovieForBehavioralMemory(movie(3),memory).score).toBe(0);
});
