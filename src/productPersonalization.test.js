import {buildRecommendationRationale} from './recommendationInsights';
const primary={id:1,title:'One',runtime:95,genre_names:['Mystery'],vote_average:7};
const result={primary,rationale:{summaryLine:'A clever mystery.',personalization_hint:'Close to the mysteries you have been saving.'},validation:{behavioral_memory_applied:true}};
test('legacy standalone taste hints are suppressed',()=>{
 expect(buildRecommendationRationale({pickResult:result,activePick:primary}).personalizationHint).toBe('');
 expect(buildRecommendationRationale({pickResult:{...result,validation:{}},activePick:primary}).personalizationHint).toBe('');
 expect(buildRecommendationRationale({pickResult:result,activePick:{...primary,id:2}}).personalizationHint).toBe('');
 expect(buildRecommendationRationale({pickResult:{...result,rationale:{summaryLine:'Plain'}},activePick:primary}).personalizationHint).toBe('');
});
