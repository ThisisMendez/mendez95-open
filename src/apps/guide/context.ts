export type Persona = 'snip-e' | 'pip';
export type Turn = { role: 'user' | 'assistant'; content: string };
export type GuideRequest = { question: string; persona: Persona; context: Turn[] };
export function boundedContext(turns: Turn[]): Turn[] {
    const result = turns.slice(-4).map(turn => ({ role: turn.role, content: turn.content }));
    while (result.length && result.reduce((n, turn) => n + turn.content.length, 0) > 2000) result.splice(0, 2);
    return result;
}
export function parseGuideRequest(value: unknown): GuideRequest | null {
    if (!value || typeof value !== 'object') return null;
    const v = value as Record<string, unknown>;
    if (Object.keys(v).some(key => !['question', 'persona', 'context'].includes(key)) || typeof v.question !== 'string' || !v.question.trim() || v.question.trim().length > 300 || (v.persona !== undefined && v.persona !== 'pip' && v.persona !== 'snip-e')) return null;
    const turns = v.context ?? [];
    if (!Array.isArray(turns) || turns.length > 40 || turns.length % 2) return null;
    if (turns.some((turn, index) => !turn || typeof turn !== 'object' || Object.keys(turn).some(key => !['role', 'content'].includes(key)) || turn.role !== (index % 2 ? 'assistant' : 'user') || typeof turn.content !== 'string' || turn.content.length > 2000)) return null;
    return { question: v.question.trim(), persona: v.persona === 'pip' ? 'pip' : 'snip-e', context: boundedContext(turns) };
}
