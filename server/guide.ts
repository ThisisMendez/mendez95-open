import { randomBytes } from 'node:crypto';
import type { Express, Request } from 'express';
import { publicContent } from './content';
import { generatedAnswer } from './guideGeneration';
import { clientRateKey } from './clientAddress';

import {tokens,sources,rank,localAnswer,playfulAnswer, parseGuideRequest,retrievalQuestion,guideTopic,currentFactLimitation,privacyRefusal,socialQuestion,fallbackAnswer,SPECIFIC_FACT_TERMS} from './guideCore';
export {describeJordan} from './guideCore';
const modelHits = new Map<string,{count:number;reset:number}>();
const rateSalt=randomBytes(24);
let dailyModelUse={day:'',count:0};
let minuteModelUse={minute:0,count:0};
// Local preview only. Deployed generation uses Worker/D1 atomic shared claims.
function modelAllowed(req: Request) {
  const now = Date.now(), day = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  if (dailyModelUse.day !== day) dailyModelUse = { day, count: 0 };
  const minute = Math.floor(now / 60000);
  if (minuteModelUse.minute !== minute) minuteModelUse = {minute,count:0};
  if (dailyModelUse.count >= 20 || minuteModelUse.count >= 10) return false;
  const ip = clientRateKey(req, rateSalt);
  const entry = modelHits.get(ip) || { count: 0, reset: now + 60_000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 60_000; }
  if (entry.count >= 10) return false;
  entry.count++; modelHits.set(ip, entry); dailyModelUse.count++; minuteModelUse.count++; return true;
}
export function mountGuideRoutes(app: Express) {
  app.get('/api/guide/suggestions', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ suggestions: ['Who is Jordan?', 'Tell me a joke.', 'What can you do?', 'Are you an AI?'] });
  });
  app.post('/api/guide', async (req, res) => {
    const request = parseGuideRequest(req.body);
    if (!request) { res.status(400).json({ error: 'Write up to 300 characters.' }); return; }
    const { question, persona } = request;
    try {
      if (privacyRefusal(question)) { res.json(localAnswer([], false)); return; }
      const pool = sources(await publicContent());
      if(guideTopic(request,pool)==='current'){res.json(currentFactLimitation(persona));return;}
      const resolved = retrievalQuestion(request, pool);
      const specificFacts = tokens(question).filter(word => SPECIFIC_FACT_TERMS.has(word));
      const introduction = /^(?:who is|tell me about) jordan(?: mendez)?[?.! ]*$/i.test(question) ? pool.filter(item => item.id === 'introduction:journey') : [];
      const candidates = playfulAnswer(question) ? [] : (introduction.length ? introduction : rank(resolved, pool).map(item => item.source)).filter(source => specificFacts.every(word => tokens(source.search).includes(word)));
      const includeLinks = /\b(link|links|source|sources|where|find|open|navigate|download|contact|read|visit)\b/i.test(question);
      let answer = !candidates.length && socialQuestion(question) ? fallbackAnswer(question, persona) : localAnswer(candidates, includeLinks);
      const config = { GEMINI_API_KEY: process.env.MENDEZ_OS_MODEL_API_KEY, MODEL_NAME: process.env.MENDEZ_OS_MODEL_NAME, MODEL_ENABLED: process.env.MENDEZ_OS_MODEL_ENABLED, MODEL_FREE_TIER_CONFIRMED: process.env.MENDEZ_OS_MODEL_FREE_TIER_CONFIRMED };
      if (process.env.NODE_ENV !== 'production' && config.GEMINI_API_KEY && config.MODEL_NAME === 'gemini-3.5-flash-lite' && config.MODEL_ENABLED === 'true' && config.MODEL_FREE_TIER_CONFIRMED === 'true' && modelAllowed(req)) {
        answer = await generatedAnswer(question, candidates, config, undefined, request) || answer;
      }
      res.setHeader('Cache-Control', 'no-store'); res.json(answer);
    } catch { res.status(500).json({ error: 'Guide is unavailable.' }); }
  });
}
