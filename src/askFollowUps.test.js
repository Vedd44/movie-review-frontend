import { askSubjectKey, filterAskedFollowUps } from './askFollowUps';
test('remembers answered topics across the session and common rewordings', () => {
  const history = ['Who stars in it?', 'Is this based on a true story?', 'Who directed it?'].map(question => ({subject:'movie:1', question}));
  expect(filterAskedFollowUps(['Who is in the cast?', 'Who is the director?', 'How long is it?', 'Find me something else like this'], history, 'movie:1')).toEqual(['How long is it?', 'Find me something else like this']);
});
test('preserves distinct decisions and more specific cast questions', () => {
  const history = ['Who stars in it?', 'How violent is it?', 'How long is it?'].map(question => ({subject:'movie:1',question}));
  expect(filterAskedFollowUps(['Who does Brad Pitt play?', 'Who stars as the detective?', 'Is it scary?', 'Is it a slow burn?', 'How long does the opening scene last?'], history, 'movie:1')).toHaveLength(5);
});
test('deduplicates punctuation and capitalization but allows questions for another movie or person', () => {
  expect(filterAskedFollowUps(['Who stars in it?', 'WHO STARS IN IT', 'How long is it?'], [{subject:'movie:1',question:'Who stars in it?'}], 'movie:2')).toEqual(['Who stars in it?', 'How long is it?']);
  expect(askSubjectKey({page:'person',personId:3})).not.toBe(askSubjectKey({page:'person',personId:4}));
  expect(askSubjectKey({movieId:1}, {anchorMovie:{id:2}})).toBe('movie:2');
});
