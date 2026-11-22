import {afterEach,expect,it,vi} from 'vitest';
import {generatedAnswer} from './guideGeneration';
const config={MODEL_ENABLED:'true',MODEL_FREE_TIER_CONFIRMED:'true',MODEL_NAME:'gemini-3.5-flash-lite',GEMINI_API_KEY:'fixture-key-not-real'};
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
it.each([429,503])('fails closed on provider HTTP %i without another provider attempt',async(status)=>{
 const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json({error:{message:'Fixture unavailable'}},{status}));
 expect(await generatedAnswer('Hello!',[],config)).toBeNull();expect(fetch).toHaveBeenCalledOnce();
});
it('bounds the entire provider response wait and recovers from an abort',async()=>{
 vi.useFakeTimers();
 const timeout=vi.spyOn(AbortSignal,'timeout').mockImplementation(ms=>{const controller=new AbortController();setTimeout(()=>controller.abort(new DOMException('Fixture timeout','TimeoutError')),ms);return controller.signal;});
 const fetch=vi.spyOn(globalThis,'fetch').mockImplementation((_url,options)=>new Promise((_resolve,reject)=>{const signal=options?.signal;signal?.addEventListener('abort',()=>reject(signal.reason),{once:true});}));
 const answer=generatedAnswer('Hello!',[],config);await vi.advanceTimersByTimeAsync(5000);expect(await answer).toBeNull();expect(timeout).toHaveBeenCalledWith(5000);expect(fetch).toHaveBeenCalledOnce();
});
it('rejects malformed provider output instead of reporting a generated reply',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('not JSON',{status:200}));expect(await generatedAnswer('Hello!',[],config)).toBeNull();
});
it('allows a useful general explanation without portfolio citations and sends the selected persona',async()=>{
 const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json({candidates:[{content:{parts:[{text:JSON.stringify({answer:'A rainbow forms when light refracts and reflects through water droplets.',sourceIds:[]})}]}}]}));
 const reply=await generatedAnswer('How do rainbows form?',[],config,undefined,{question:'How do rainbows form?',persona:'pip',context:[]});
 expect(reply?.mode).toBe('model-assisted');expect(reply?.citations).toEqual([]);
 const payload=JSON.parse(String(fetch.mock.calls[0]![1]?.body));expect(payload.systemInstruction.parts[0].text).toContain('curious cat');expect(payload.systemInstruction.parts[0].text).toContain('General conversation');
});
it('does not accept unsupported portfolio achievements or invented general-answer career pivots',async()=>{
 const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json({candidates:[{content:{parts:[{text:JSON.stringify({answer:'Jordan achieved a 99% pass rate.',sourceIds:[]})}]}}]}));
 expect(await generatedAnswer('What did Jordan achieve?',[],config)).toBeNull();
 expect(await generatedAnswer('How do rainbows form?',[],config)).toBeNull();expect(fetch).toHaveBeenCalledTimes(2);
});
it('does not turn a user assertion about yesterday into verified current facts',async()=>{
 const fetch=vi.spyOn(globalThis,'fetch');const reply=await generatedAnswer('The Seahawks won yesterday, what were their stats?',[],config);
 expect(reply?.answer).toContain('can’t confirm');expect(reply?.mode).toBe('local');expect(fetch).not.toHaveBeenCalled();
});
