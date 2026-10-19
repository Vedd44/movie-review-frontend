import { browseHistoryKey, readBrowseHistory, writeBrowseHistory, clearBrowseHistory } from './browseHistory';
beforeEach(clearBrowseHistory);
const snapshot = {movies:[{id:1}],totalPages:2};
test('history entries and filters do not share snapshots',()=>{
 const a=browseHistoryKey('guest','entry-a','genre=35');
 writeBrowseHistory(a,snapshot);
 expect(readBrowseHistory(browseHistoryKey('guest','entry-b','genre=35'))).toBeUndefined();
 expect(readBrowseHistory(browseHistoryKey('guest','entry-a','genre=878'))).toBeUndefined();
 expect(readBrowseHistory(a)).toEqual(snapshot);
});
test('switching auth owner clears prior snapshots, including a later return',()=>{
 const a=browseHistoryKey('alice','a','query');
 writeBrowseHistory(a,snapshot);
 const b=browseHistoryKey('bob','a','query');
 expect(readBrowseHistory(b)).toBeUndefined();
 expect(readBrowseHistory(browseHistoryKey('alice','a','query'))).toBeUndefined();
});
test('cache is bounded and oversize snapshots are not retained',()=>{
 const keys=Array.from({length:9},(_,i)=>browseHistoryKey('guest',String(i),'query'));
 keys.forEach(key=>writeBrowseHistory(key,snapshot));
 expect(readBrowseHistory(keys[0])).toBeUndefined();
 expect(readBrowseHistory(keys[8])).toEqual(snapshot);
 const big=browseHistoryKey('guest','large','query');
 writeBrowseHistory(big,{movies:Array.from({length:1001},(_,id)=>({id})),totalPages:100});
 expect(readBrowseHistory(big)).toBeUndefined();
});
