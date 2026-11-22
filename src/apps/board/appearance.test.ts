import {describe,it,expect} from 'vitest';
import {CHARACTERS,LEGACY_CHARACTERS,ADDED_CHARACTERS,COLORS,PRIMARY_COLORS,noteAppearance,portraitSprite,isCharacter,isColor} from './appearance';
describe('portrait expansion preserves historical attribution',()=>{
  it('retains the original twelve IDs, appends eight unique portraits, and retains legacy colors',()=>{
    expect(CHARACTERS.slice(0,12)).toEqual(['scout','sprout','orbit','moss','spark','cloud','pebble','wave','comet','fern','sunny','echo']);
    expect(CHARACTERS).toHaveLength(20);expect(new Set(CHARACTERS).size).toBe(20);
    expect(PRIMARY_COLORS).toEqual(['teal','coral','blue','amber']);expect(COLORS).toHaveLength(6);
    for(const id of CHARACTERS)expect(isCharacter(id)).toBe(true);
    expect(isColor('violet')).toBe(true);expect(isColor('forest')).toBe(true);
  });
  it('uses frozen twelve-character hashing for existing notes with omitted appearances',()=>{
    for(const id of ['1234567890abcdef12345678',...Array.from({length:100},(_,i)=>`sample-note-${i}`)]){
      let hash=0;for(const char of id)hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0;
      expect(noteAppearance({id})).toEqual({characterId:LEGACY_CHARACTERS[hash%12],colorId:COLORS[hash%6]});
    }
    expect(noteAppearance({id:'unchanged',characterId:'willow',colorId:'forest'})).toEqual({characterId:'willow',colorId:'forest'});
  });
  it('keeps original crop coordinates and gives every added portrait a unique cell in its own atlas',()=>{
    LEGACY_CHARACTERS.forEach((id,i)=>expect(portraitSprite(id)).toEqual({src:'/portraits/messenger-atlas-v1.svg',columns:4,rows:3,column:i%4,row:Math.floor(i/4)}));
    ADDED_CHARACTERS.forEach((id,i)=>expect(portraitSprite(id)).toEqual({src:'/portraits/messenger-atlas-v2.svg',columns:4,rows:2,column:i%4,row:Math.floor(i/4)}));
  });
});
