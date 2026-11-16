import { classifyAskIntent, ASK_INTENTS as I } from './askIntent';
import { parseSeenFeedback } from './seenFeedback';
const conversation={activeIntent:I.GENERAL_RECOMMENDATION,activeRequest:'An adult sci-fi thriller under 100 minutes, no horror',anchorMovie:{id:1,title:'First'}};
describe.each(['home','browse','movie_detail','general'])('%s seen-feedback intent',page=>{
 test.each(["I've seen it",'I already watched this','I have already watched that movie','Seen this already','Already seen that',"I've seen this before", "I've seen it, another one please.", "I've seen it, another one?", "I've seen it. Could you give me another movie?", "I've seen it. Give me another movie.", 'I’ve already seen this'   ,"I've seen this, another one"])( '%s continues the request',prompt=>{
  expect(classifyAskIntent({prompt,context:{page},conversation})).toBe(I.REFINE_RECOMMENDATION);
 });
 test.each(["I've seen it. Who directed it?",'I watched this, can you explain the ending?',"I've seen it; is it based on a book?","I've seen it. When was it released?", "I've seen it. Where was it filmed?", "I've seen it... who directed it?", "I've seen it, but who directed it?", "I've seen it. Who plays another character?", "I've seen it. Why did you pick it?", "I've seen it and who directed it?", 'I have seen that movie. Why is it so scary?'   ])('%s remains a question',prompt=>{
  expect(classifyAskIntent({prompt,context:{page},conversation})).toBe(I.CURRENT_MOVIE_QUESTION);
 });
});
test.each(['I have not seen this',"I haven't watched it",'Have I seen this?','I have seen this actor before',"I've seen Alien",'I have seen "It"'])('%s is not affirmative pronoun feedback',prompt=>{
 expect(parseSeenFeedback(prompt).seen).toBe(false);
});
test('explicit fresh topic wins',()=>{
 expect(classifyAskIntent({prompt:'I watched this. Start fresh: a romantic comedy',conversation})).toBe(I.GENERAL_RECOMMENDATION);
});

test.each(["I've seen it. Can you recommend a comedy?", "I've seen it. Could you give me another movie?"])('%s remains a recommendation',prompt=>{expect(classifyAskIntent({prompt,conversation})).toMatch(/RECOMMENDATION/);});
