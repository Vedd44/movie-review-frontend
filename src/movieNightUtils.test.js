import { movieNightPath, parseMovieNight, shareMovieNight } from './movieNightUtils';

test('shortlist is bounded and choices must belong to it', () => {
  expect(parseMovieNight('?movies=1,1,2,3,4,-5,x&choice=4')).toEqual({ ids: [1,2,3], choice: null });
  expect(parseMovieNight('?movies=1,2&choice=2').choice).toBe(2);
  expect(parseMovieNight('?movies=1e3,0,9007199254740993').ids).toEqual([]);
});
test('links include only movie IDs and a valid choice', () => {
  const path = movieNightPath([{id:1,title:'Private',source_prompt:'private taste'},{id:2},{id:3},{id:4}], 2);
  expect(parseMovieNight(path.split('?')[1])).toEqual({ids:[1,2,3], choice:2});
  expect(path).not.toMatch(/Private|private/);
});
test('sharing uses native share and cancellation is passed back', async () => {
  Object.defineProperty(navigator, 'share', { configurable:true, value:jest.fn().mockResolvedValue(undefined) });
  expect(await shareMovieNight('https://reelbot.movie/movie-night?movies=1', 'Our picks')).toBe('Shared');
  expect(navigator.share).toHaveBeenCalledTimes(1);
  navigator.share.mockRejectedValue(Object.assign(new Error('cancel'), {name:'AbortError'}));
  await expect(shareMovieNight('url', 'text')).rejects.toHaveProperty('name','AbortError');
  delete navigator.share;
});
test('clipboard fallback copies the usable choice link', async () => {
  const writeText=jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {configurable:true,value:{writeText}});
  expect(await shareMovieNight('https://reelbot.movie/movie-night?movies=1&choice=1','My vote')).toBe('Link copied');
  expect(writeText).toHaveBeenCalledWith('My vote\nhttps://reelbot.movie/movie-night?movies=1&choice=1');
});
