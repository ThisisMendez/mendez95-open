import{describe,it,expect}from'vitest';import{clampCompanion,parseCompanionPosition,movedCompanion,placeCompanion}from'./companionPosition';
describe('desktop companion positioning boundary',()=>{
 it('keeps a saved point inside a resized usable desktop, clear of chrome',()=>{expect(clampCompanion({x:1800,y:900},1024,600)).toEqual({x:872,y:380});expect(clampCompanion({x:-200,y:-10},1280,800)).toEqual({x:8,y:55});});
 it('chooses a clear initial position rather than covering widget controls',()=>{expect(placeCompanion([{x:800,y:600},{x:600,y:600}],1200,900,[{x:800,y:400,width:350,height:400}])).toEqual({x:600,y:600});});
 it('rejects corrupt/nonfinite preference data and treats a drag separately from a click',()=>{for(const v of ['bad','null','{"x":"20","y":30}','{"x":null,"y":20}'])expect(parseCompanionPosition(v)).toBeNull();expect(parseCompanionPosition('{"x":30,"y":50}')).toEqual({x:30,y:50});expect(movedCompanion({x:10,y:10},{x:13,y:12})).toBe(false);expect(movedCompanion({x:10,y:10},{x:20,y:10})).toBe(true);});
});
