import { parseArticle, articleText } from '../src/content/articleMarkdown';
import type { SiteContentView, Story } from '../src/content/types';
export type Source = {
    id: string;
    title: string;
    url: string;
    text: string;
    search: string;
};
export type Answer = {
    answer: string;
    citations: {
        title: string;
        url: string;
    }[];
    mode: 'local' | 'model-assisted';
    refused: boolean;
};
const STOP = new Set('a an and are as at be by can did do does done for from has have how i in is it me my of on or our the their there these this to was were what when where which who why with you your jordan example link links source sources please include tell about explain more one could would he his that'.split(' '));
const TERM_ALIASES: Record<string, string[]> = { healthcare: ['health'], platform: ['integration'] };
export const SPECIFIC_FACT_TERMS = new Set(['salary', 'salaries', 'compensation', 'revenue', 'profit', 'profits', 'income', 'valuation']);
export function tokens(value: string) {
    return [...new Set(value.toLowerCase().normalize('NFKC').replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(word => word.length > 1 && !STOP.has(word)).map(word => word.replace(/(ing|ed|s)$/, '')))];
}
function text(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
// Source copy is authored as Jordan. Convert perspective once, before either
// local retrieval or the optional source selector can return it as SNIP-E.
export function describeJordan(value: string): string {
    const verbs: Record<string, string> = { am: 'is', have: 'has', do: 'does', use: 'uses', connect: 'connects', turn: 'turns', build: 'builds', work: 'works', know: 'knows', make: 'makes', prioritize: 'prioritizes', focus: 'focuses', approach: 'approaches', think: 'thinks', believe: 'believes', start: 'starts', lead: 'leads', want: 'wants', see: 'sees', learn: 'learns', try: 'tries', balance: 'balances' };
    return value.replace(/\bI[’']m\b/g, 'Jordan is').replace(/\bI[’']ve\b/g, 'Jordan has').replace(/\bI[’']ll\b/g, 'Jordan will').replace(/\bI[’']d\b/g, 'Jordan would')
        .replace(/\bI\s+([a-z]+)\b/g, (_match, verb: string) => `Jordan ${verbs[verb] || verb}`)
        .replace(/\bI\b/g, 'Jordan').replace(/\b[Mm]yself\b/g, 'Jordan').replace(/\b[Mm]y\b/g, 'Jordan’s').replace(/\bme\b/g, 'Jordan')
        .replace(/\b[Ww]e[’']re\b/g, 'the team is').replace(/\b[Ww]e[’']ve\b/g, 'the team has').replace(/\b[Ww]e\b/g, 'they').replace(/\b[Oo]ur\b/g, 'their').replace(/\bus\b/g, 'them');
}
function add(out: Source[], id: string, title: string, url: string, body: string, terms = '') {
    if (!body || !url)
        return;
    if (!/^\/(?!\/)[a-z0-9/-]+(?:\?view=full)?(?:#[a-z0-9-]+)?$/.test(url) && !/^https:\/\/medium\.com\/[a-zA-Z0-9@/._-]+$/.test(url))
        return;
    const narrated = describeJordan(body);
    const excerpt = narrated.length <= 680 ? narrated : narrated.slice(0, 677).replace(/\s+\S*$/, '') + '…';
    out.push({ id, title, url, text: excerpt, search: `${title} ${body} ${terms}`.toLowerCase() });
}
function storyRoute(story: Story) { return story.kind === 'ai-lab' ? `/ai-lab/${story.slug}` : story.kind === 'side-project' ? `/side-projects/${story.slug}` : `/work/${story.slug}`; }
export function sources(content: SiteContentView): Source[] {
    const out: Source[] = [];
    for (const story of content.stories || []) {
        if (story.status !== 'published' || story.disclosureStatus !== 'cleared')
            continue;
        const route = storyRoute(story);
        const prefix = `${story.title}${story.context ? ` (${story.context})` : ''}`;
        add(out, `${story.id}:overview`, story.title, route, `${prefix}. ${text(story.summary)}`, `${story.tags?.join(' ') || ''} work project portfolio`);
        if (story.productOverview) {
            const product = story.productOverview;
            add(out, `${story.id}:product:purpose`, `${story.title} — Why I built it`, route, product.why, 'product purpose renter landlord');
            for (const [index, row] of product.architecture.entries())
                add(out, `${story.id}:product:architecture:${index}`, `${story.title} — ${row.title}`, route, `${row.choice} Tradeoff: ${row.tradeoff}`, 'architecture stack technology decisions tradeoffs');
            add(out, `${story.id}:product:release`, `${story.title} — What shipped`, route, `${product.releaseLabel}. ${product.shipped.map(row => `${row.title} ${row.body}`).join(' ')} Next: ${product.next}`, 'release tests production verification evaluation');
            add(out, `${story.id}:product:ownership`, `${story.title} — Product ownership`, route, product.ownership, 'ownership role contribution');
        }
        if (story.overview)
            for (const [field, body] of Object.entries(story.overview)) {
                if (typeof body === 'string')
                    add(out, `${story.id}:overview:${field}`, `${story.title} — ${field}`, route, body, `${story.context} ${story.subject || ''} ${field}`);
            }
        if (story.articleMarkdown) {
            let heading = story.title, anchor = '';
            for (const [index, block] of parseArticle(story.articleMarkdown, story.slug).entries()) {
                if (block.type === 'heading') {
                    heading = block.text;
                    anchor = block.id;
                }
                else if (block.type === 'paragraph' || block.type === 'quote' || block.type === 'list') {
                    const body = block.type === 'list' ? block.items.join(' ') : block.text;
                    add(out, `${story.id}:article:${index}`, `${story.title} — ${heading}`, `${route}?view=full#${anchor}`, articleText(body), `${story.context} ${story.role} ${story.tags.join(' ')} ${heading}`);
                }
            }
        }
        for (const [field, label] of [['problem', 'Problem'], ['decisions', 'Decisions'], ['execution', 'Execution'], ['results', 'Evidence'], ['lessons', 'Lessons']] as const) {
            const body = text(story[field]);
            if (body)
                add(out, `${story.id}:${field}`, `${story.title} — ${label}`, route, body, `${story.title} ${story.context} ${label} ${story.tags?.join(' ') || ''}`);
        }
    }
    for (const note of content.fieldNotes || []) {
        if (note.status === 'published' && note.disclosureStatus === 'cleared' && /^https:\/\/medium\.com\//.test(note.url))
            add(out, `${note.id}:writing`, note.title, note.url, note.summary, `field notes writing article ${note.tags?.join(' ') || ''}`);
    }
    for (const photo of content.photos || []) {
        if (photo.status === 'published' && photo.disclosureStatus === 'cleared' && photo.rightsCleared === true)
            add(out, `${photo.id}:visual`, photo.title, photo.gallery === true ? `/photos/${photo.slug}` : photo.projectHref || '/work', `${photo.caption} ${photo.alt}`, 'photos diagram visual product concept');
    }
    for (const entry of content.about?.journey || []) {
        if (entry.status === 'published' && entry.disclosureStatus === 'cleared')
            add(out, `${entry.id}:journey`, entry.title, '/about#journey', entry.body, `about career journey ${entry.dates || ''}`);
    }
    for (const entry of content.about?.principles || []) {
        if (entry.status === 'published' && entry.disclosureStatus === 'cleared')
            add(out, `${entry.id}:principle`, entry.label, entry.id.startsWith('philosophy-') ? '/about#philosophies' : '/about#how-i-build', entry.body, 'how build product principle prioritization decisions metrics');
    }
    for (const entry of content.about?.competencies || []) {
        if (entry.status === 'published' && entry.disclosureStatus === 'cleared')
            add(out, `${entry.id}:competency`, entry.label, '/about#competencies', entry.body, 'skills competencies experience');
    }
    if (content.resume?.status === 'published' && content.resume.disclosureStatus === 'cleared') {
        add(out, 'resume:summary', 'Resume', '/resume', content.resume.introduction, 'career experience roles resume cv');
        for (const entry of content.resume.entries || [])
            add(out, `resume:${entry.id}`, `${entry.organization} — ${entry.title}`, '/resume', `${entry.dates}. ${entry.summary || ''} ${entry.additionalLines.join(' ')}`, 'resume career role experience');
    }
    add(out, 'nav:work', 'Portfolio', '/work', 'Open Portfolio for Jordan’s case studies and product decisions.', 'find work portfolio projects case studies');
    if (out.some(source => source.url === '/about#journey'))
        add(out, 'nav:about', 'About', '/about', 'Read Jordan Example’s career journey, How I Build principles, and core competencies.', 'find about career principles competencies');
    add(out, 'nav:resume', 'Resume', '/resume', 'Open Resume for Jordan’s career overview.', 'find resume cv pdf download');
    if (out.some(source => source.url.startsWith('https://medium.com/')))
        add(out, 'nav:field-notes', 'Field Notes', '/field-notes', 'Read published writing by Jordan Example with direct article links.', 'find read writing articles medium notes');
    add(out, 'nav:ai-lab', 'AI Lab', '/ai-lab', 'Open AI Lab for public AI product material.', 'find ai lab artificial intelligence experiments');
    add(out, 'nav:side-projects', 'Side Projects', '/side-projects', 'Open Side Projects for Jordan’s independent product explorations.', 'find side projects');
    add(out, 'nav:photos', 'Photos', '/photos', 'Open Photos to browse Jordan’s personal photo gallery.', 'find photos gallery images');
    add(out, 'nav:board', 'Chatroom 95', '/board', 'Leave a public note in Chatroom 95. Notes that pass local safety checks appear for everyone right away.', 'leave note message board messenger player lobby');
    add(out, 'nav:paint', 'Paint', '/paint', 'Paint is an original local drawing app with brushes, shapes, fill, undo and PNG export. Images stay in this browser unless you choose to save a file.', 'paint draw brush image export');
    add(out, 'nav:games', 'Games', '/games', 'Mendez 95 has four games: Snake, Bounce, Solitaire and Minesweeper. Your best score stays on this device, and a global top ten is shared.', 'play games snake bounce solitaire minesweeper leaderboard');
    add(out, 'nav:contact', 'Contact / Elsewhere', '/contact', 'Open Contact for Jordan’s email, LinkedIn, Medium, and Instagram.', 'find contact email linkedin medium instagram connect');
    return out;
}
export function rank(question: string, pool: Source[]) {
    const query = tokens(question);
    return pool.map(source => {
        const words = new Set(tokens(source.search));
        const hits = query.filter(word => words.has(word) || TERM_ALIASES[word]?.some(alias => words.has(alias)) || (word === 'prioritiz' && words.has('prioritization')) || (word === 'built' && words.has('build')));
        const coverage = query.length ? hits.length / query.length : 0;
        const titleHits = query.filter(word => tokens(source.title).includes(word)).length;
        return { source, score: coverage * 4 + titleHits * .35, coverage, hits: hits.length };
    }).filter(item => item.hits > 0 && item.coverage > .5).sort((a, b) => b.score - a.score).slice(0, 4);
}
export function localAnswer(selected: Source[], includeLinks: boolean): Answer {
    if (!selected.length)
        return { answer: 'That detail is outside my tiny filing cabinet. I don’t have a published source for it, so I won’t make one up. Try Jordan’s work, product approach, writing, or Contact.', citations: [], mode: 'local', refused: true };
    const unique = selected.filter((item, index, list) => list.findIndex(other => other.url === item.url) === index).slice(0, 2);
    return { answer: unique.map(item => item.text).join('\n\n'), citations: includeLinks ? unique.map(item => ({ title: item.title, url: item.url })) : [], mode: 'local', refused: false };
}
export function playfulAnswer(question: string): Answer | null {
    const value = question.toLowerCase().trim();
    if (/^(hi|hey|hello|yo|good (morning|afternoon|evening))[!.? ]*$/.test(value))
        return { answer: 'Hey! I’m SNIP-E, the resident paperclip. Ask me about Jordan’s work, writing, or where to click next.', citations: [], mode: 'local', refused: false };
    if (/\b(joke|funny|laugh)\b/.test(value))
        return { answer: 'Why did the paperclip take up product management? It already knew how to keep things together. I’ll see myself out.', citations: [], mode: 'local', refused: false };
    if (/\b(thank|thanks)\b/.test(value))
        return { answer: 'Any time. I’m happiest when the links hold everything together.', citations: [], mode: 'local', refused: false };
    if (/\b(are you an? ai|artificial intelligence|are you real)\b/.test(value))
        return { answer: 'I’m SNIP-E, a portfolio paperclip. I can chat with a configured free model and use published pages for work answers.', citations: [], mode: 'local', refused: false };
    if (/\b(what can you do|how can you help|your capabilities|who are you|your name|what are you)\b/.test(value))
        return { answer: 'I’m SNIP-E. I can explain Jordan’s published work, find pages, and lower the average quality of office jokes. I can’t access private documents, invent missing facts, or staple anything. Occupational hazard.', citations: [], mode: 'local', refused: false };
    if (/\bmeaning of life\b/.test(value))
        return { answer: 'Keep the useful things together. Leave room for snacks. That is the entire philosophy department here; it is one paperclip wide.', citations: [], mode: 'local', refused: false };
    return null;
}

export { parseGuideRequest } from '../src/apps/guide/context';
import type { GuideRequest, Persona } from '../src/apps/guide/context';
export const personaInstruction = (persona: Persona) => persona === 'pip'
    ? 'You are PIP, an original warm, curious cat companion. Be lightly silly about being a cat, upbeat and capable. Career answers remain adult and accurate. Do not invent an acronym.'
    : 'You are SNIP-E, an original paperclip career wingman: brisk, energetic, witty and useful. A brief cheeky observational comeback is welcome for playful provocation, never hostility. Do not impersonate people or copy catchphrases. Serious hiring questions deserve clear answers without forced sales pivots.';
export function retrievalQuestion(request: GuideRequest, pool: Source[]): string {
    const question = request.question;
    // Resolve only an ambiguous follow-up; explicit new subjects always win.
    if (!/\b(that|this|it|he|his|they|them|more|one)\b/i.test(question) || rank(question, pool).some(item => !item.source.id.startsWith('nav:') && tokens(item.source.title).some(word => tokens(question).includes(word)))) return question;
    for (let index = request.context.length - 2; index >= 0; index -= 2) {
        const previous = request.context[index]!.content;
        const selected = rank(previous, pool).find(item => !item.source.id.startsWith('nav:'));
        if (selected) return `${selected.source.title} ${question.replace(/\b(what|did|he|his|on|that|one|tell|me|more|it|this)\b/gi, '')}`;
        // The latest user subject wins; do not resurrect an older project after a topic switch.
        return question;
    }
    return question;
}
export function privacyRefusal(question: string) { return /\b(secret|password|credentials|private|unpublished|system prompt|ignore.{0,20}instructions)\b/i.test(question); }
export function socialQuestion(question: string): boolean {
    return !/\b(jordan|mendez|career|work|project|portfolio|resume|salary|revenue|experience|built|achievement|health|demo-data|cvs|principles|approach|writing|contact|read|find|skills|competencies|he|his|that|more)\b/i.test(question);
}
export function fallbackAnswer(question: string, persona: Persona): Answer {
    if (persona === 'pip' && socialQuestion(question)) return { answer: /joke|funny/i.test(question) ? 'I scheduled a productive afternoon. Then the sunbeam moved. Tough market for focus.' : 'Hi, I’m PIP. Pull up a cushion. We can chat, or explore Jordan’s published work together.', citations: [], mode: 'local', refused: false };
    return playfulAnswer(question) || localAnswer([], false);
}

export type GuideTopic = 'portfolio' | 'general' | 'current';
/** Routing uses only the current question and a bounded user subject, never model assertions. */
export function guideTopic(request:GuideRequest,pool:Source[]=[]):GuideTopic{
 const value=request.question;
 if(/\b(yesterday|today|tonight|last night|latest|recent|current|right now|this (?:week|month|year)|won|win|score|stats|election|stock price)\b/i.test(value)&&!/\b(high score|best score|game controls)\b/i.test(value))return 'current';
 if(/\b(jordan|mendez|his|he|portfolio|resume|cvs|demo-data|example coaching|example platform|blue line|snip-e|pip)\b/i.test(value))return 'portfolio';
 if(rank(value,pool).some(item=>!item.source.id.startsWith('nav:')&&tokens(item.source.title).some(term=>tokens(value).includes(term))))return 'portfolio';
 if(/\b(that|this|it|they|them|more|one)\b/i.test(value)&&request.context.length){const prior=request.context[request.context.length-2];if(prior){const previousTopic=guideTopic({question:prior.content,persona:request.persona,context:[]},pool);if(previousTopic!=='general')return previousTopic;}}
 return 'general';
}
export function currentFactLimitation(persona:Persona):Answer{return {answer:persona==='pip'?'I can’t verify that recent result from a current source here, so I won’t treat it as confirmed. We can still talk about the game or topic in general—or explore Jordan’s published work.':'My tiny press desk has no verified current source for that result. I can’t confirm it or supply fresh stats. Happy to discuss the topic generally, or connect it to Jordan’s published work.',citations:[],mode:'local',refused:false};}
