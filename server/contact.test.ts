import express from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { mountContactRoutes } from './contact';
import { CONTACT_RECIPIENT, type MailMessage } from './mail';
const servers: Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve())))); });
async function setup(configured = true, fail = false) {
  const sent: MailMessage[] = [], app = express(); app.use(express.json()); mountContactRoutes(app, { configured, async send(message) { if (fail) throw new Error('Mock delivery failure'); sent.push(message); } });
  const server = await new Promise<Server>(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); }); servers.push(server); const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing address');
  const call = (body: unknown, origin?: string) => fetch(`http://127.0.0.1:${address.port}/api/contact`, { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });
  return { sent, call };
}
const input = { name: 'Visitor', email: 'visitor@example.test', message: 'Let’s talk about a product role.', to: 'attacker@example.test' };
describe('contact route with local mock mail only', () => {
  it('sends to the fixed recipient with visitor Reply-To and validates the boundary', async () => { const test = await setup(); expect((await test.call(input)).status).toBe(200); expect(test.sent[0]).toMatchObject({ to: CONTACT_RECIPIENT, replyTo: input.email }); expect((await test.call({ ...input, email: 'x\r\nBcc: other@example.test' })).status).toBe(400); expect((await test.call(input, 'https://attacker.test')).status).toBe(403); expect((await test.call({ ...input, website: 'spam' })).status).toBe(400); });
  it('rate limits repeated submissions without extra mail', async () => { const test = await setup(); for (let i = 0; i < 5; i++) expect((await test.call(input)).status).toBe(200); expect((await test.call(input)).status).toBe(429); expect(test.sent).toHaveLength(5); });
  it('never reports success when unavailable or rejected by the transport', async () => { const unavailable = await setup(false); const response = await unavailable.call(input); expect(response.status).toBe(503); expect((await response.json()).error).toContain('not sent'); expect(unavailable.sent).toEqual([]); const broken = await setup(true, true); expect((await broken.call(input)).status).toBe(502); });
});
