import {it,expect} from 'vitest';
import {isNearTranscriptBottom,shouldFollowTranscript} from './transcriptScroll';
it('follows initial data and a successful post but respects a reader in older notes during polling',()=>{
  expect(shouldFollowTranscript({initial:true,posted:false,nearBottom:false})).toBe(true);
  expect(shouldFollowTranscript({initial:false,posted:true,nearBottom:false})).toBe(true);
  expect(shouldFollowTranscript({initial:false,posted:false,nearBottom:false})).toBe(false);
  expect(shouldFollowTranscript({initial:false,posted:false,nearBottom:true})).toBe(true);
});
it('allows a few text lines of bottom tolerance, including a short or overscrolled transcript',()=>{
  expect(isNearTranscriptBottom({scrollHeight:1000,clientHeight:300,scrollTop:636})).toBe(true);
  expect(isNearTranscriptBottom({scrollHeight:1000,clientHeight:300,scrollTop:635})).toBe(false);
  expect(isNearTranscriptBottom({scrollHeight:100,clientHeight:300,scrollTop:0})).toBe(true);
  expect(isNearTranscriptBottom({scrollHeight:1000,clientHeight:300,scrollTop:710})).toBe(true);
});
