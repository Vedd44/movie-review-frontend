test('detail shares use production even in a preview-configured build', () => {
  const previous = process.env.REACT_APP_SITE_URL;
  process.env.REACT_APP_SITE_URL = 'https://preview.example.test';
  jest.isolateModules(() => {
    const { buildPublicShareUrl } = require('./siteConfig');
    expect(buildPublicShareUrl('/people/sigourney-weaver?private=prompt#credits')).toBe('https://reelbot.movie/people/sigourney-weaver');
  });
  if (previous === undefined) delete process.env.REACT_APP_SITE_URL;
  else process.env.REACT_APP_SITE_URL = previous;
});
