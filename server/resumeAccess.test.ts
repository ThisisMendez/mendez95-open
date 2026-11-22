import express from 'express';
import type { Server } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MailMessage, MailTransport } from './mail';

const servers: Server[] = [], directories: string[] = [];
let mountResume: typeof import('./resumeAccess').mountResumeAccessRoutes;
let mountAuth: typeof import('./auth').mountOwnerAuthRoutes;
beforeAll(async () => {
  vi.stubEnv('MENDEZ_OS_OWNER_PASSWORD', 'test-only-resume-owner');
  ({ mountResumeAccessRoutes: mountResume } = await import('./resumeAccess'));
  ({ mountOwnerAuthRoutes: mountAuth } = await import('./auth'));
});
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))));
  await Promise.all(directories.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});
async function setup(configured = true, existingDir?: string) {
  await mkdir(join(process.cwd(), '.local'), { recursive: true });
  const dataDir = existingDir || await mkdtemp(join(process.cwd(), '.local/resume-test-')); if (!existingDir) directories.push(dataDir);
  let fail = false, time = Date.parse('2026-10-21T12:00:00Z');
  const sent: MailMessage[] = [];
  const mail: MailTransport = { configured, async send(message) { if (fail) throw new Error('Local mock transport failure'); sent.push(message); } };
  const app = express(); app.use(express.json({ limit: '7mb' })); mountAuth(app); mountResume(app, { dataDir, mail, now: () => time });
  const server = await new Promise<Server>(resolve => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); }); servers.push(server);
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing test address');
  const base = `http://127.0.0.1:${address.port}`;
  const call = (path: string, body?: unknown, headers: Record<string, string> = {}, method = body === undefined ? 'GET' : 'POST') => fetch(base + path, { method, headers: { 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const login = await call('/api/owner/login', { password: 'test-only-resume-owner' }); const session = await login.json();
  const owner = { cookie: login.headers.get('set-cookie')!.split(';')[0]!, 'x-mendez-csrf': session.csrfToken };
  const request = async (name = 'Recruiter') => { const response = await call('/api/resume/requests', { name, email: 'recruiter@example.test', company: 'Example team', reason: 'A product role' }); expect(response.status).toBe(201); return response.json(); };
  const inbox = async () => (await call('/api/owner/resume/requests', undefined, owner)).json();
  const action = (id: string, action: string) => call(`/api/owner/resume/requests/${id}/${action}`, {}, owner);
  return { call, inbox, request, action, sent, dataDir, owner, fail: (value: boolean) => { fail = value; } };
}

describe('manual resume inbox with local mock mail only', () => {
  it('saves requests and sends only fixed owner notification without a PDF or public origin', async () => {
    const test = await setup(); const result = await test.request();
    expect(result.notificationSent).toBe(true); expect(result.message).toContain('follow up');
    const row = (await test.inbox()).requests[0];
    expect(test.sent).toHaveLength(1); expect(test.sent[0]).toMatchObject({ to: 'owner@example.invalid', replyTo: 'recruiter@example.test', subject: 'Mendez 95: Resume request' });
    for (const detail of [row.name, row.company, row.email, row.reason, row.requestedAt, row.id]) expect(test.sent[0]!.text).toContain(detail);
    expect(row.requestedAt).toBe('2026-10-21T12:00:00.000Z');
    expect(await readdir(join(test.dataDir, 'resume-access'))).toEqual(['requests.json']);
    const stored = JSON.parse(await readFile(join(test.dataDir, 'resume-access/requests.json'), 'utf8'))[0];
    for (const key of ['tokenHash', 'expiresAt', 'delivery']) expect(stored[key]).toBeUndefined();
    expect((await test.call('/api/owner/resume/requests')).status).toBe(401);
    expect((await test.call(`/api/owner/resume/requests/${row.id}/handled`, {})).status).toBe(401);
    expect((await test.call(`/api/owner/resume/requests/${row.id}/handled`, {}, { cookie: test.owner.cookie })).status).toBe(403);
    expect((await test.call(`/api/owner/resume/requests/${row.id}/handled`, {}, { ...test.owner, origin: 'https://attacker.test' })).status).toBe(403);
    expect((await test.call(`/api/owner/resume/requests/${row.id}/handled`, undefined, test.owner)).status).toBe(404);
    expect((await test.action(row.id, 'handled')).status).toBe(200); expect((await test.inbox()).requests[0].status).toBe('handled');
    await test.action(row.id, 'archive'); expect((await test.inbox()).requests[0].status).toBe('archived');
    await test.action(row.id, 'reopen'); expect((await test.inbox()).requests[0].status).toBe('pending');
    expect((await test.action(row.id, 'notify')).status).toBe(409); expect(test.sent).toHaveLength(1);
    const restarted = await setup(true, test.dataDir); expect((await restarted.inbox()).requests[0].id).toBe(row.id);
  });
  it('saves notification failures and permits only protected owner retry', async () => {
    const test = await setup(); test.fail(true); const result = await test.request(); expect(result.notificationSent).toBe(false); expect(result.message).toContain('request is saved');
    const row = (await test.inbox()).requests[0]; expect(row.notification).toBe('failed');
    for (const [headers, status] of [[{}, 401], [{ cookie: test.owner.cookie }, 403], [{ ...test.owner, origin: 'https://attacker.test' }, 403]] as const) expect((await test.call(`/api/owner/resume/requests/${row.id}/notify`, {}, headers)).status).toBe(status);
    expect((await test.action(row.id, 'notify')).status).toBe(502); test.fail(false); expect((await test.action(row.id, 'notify')).status).toBe(200);
    expect((await test.inbox()).requests[0].notification).toBe('sent'); expect(test.sent).toHaveLength(1); expect(test.sent[0]!.to).toBe('owner@example.invalid');
  });
  it('saves requests honestly when email is unconfigured', async () => {
    const test = await setup(false); const result = await test.request(); expect(result.notificationSent).toBe(false); expect(result.message).toContain('could not be sent');
    const row = (await test.inbox()).requests[0]; expect(row.notification).toBe('unconfigured'); expect((await test.action(row.id, 'notify')).status).toBe(503); expect(test.sent).toEqual([]);
  });
  it('disables all legacy access even for valid historical tokens, preserving the PDF and metadata', async () => {
    const test = await setup(); await test.request(); const file = join(test.dataDir, 'resume-access/requests.json');
    const items = JSON.parse(await readFile(file, 'utf8')), token = 'a'.repeat(43);
    const legacy = { ...items[0], status: 'approved', delivery: 'sent', tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: '2099-01-01T00:00:00.000Z', customLegacyMetadata: 'preserve me' };
    await writeFile(file, JSON.stringify([legacy])); const pdf = join(test.dataDir, 'resume-access/professional-resume.pdf'); await writeFile(pdf, 'legacy private document');
    for (const path of [`/api/resume/access/${token}`, `/api/resume/access/${token}?download=1`, '/api/resume/access', '/api/resume/download.pdf', '/api/owner/resume/document']) {
      expect((await test.call(path)).status).toBe(404); expect((await test.call(path, {}, test.owner, 'PUT')).status).toBe(404);
    }
    expect((await test.call(`/api/resume/access/${token}`, undefined, {}, 'HEAD')).status).toBe(404);
    for (const action of ['approve', 'decline', 'revoke']) expect((await test.action(legacy.id, action)).status).toBe(404);
    const inbox = await test.inbox(); expect(inbox.requests[0]).toMatchObject({ status: 'pending', legacyStatus: 'approved' });
    for (const key of ['tokenHash', 'expiresAt', 'delivery', 'customLegacyMetadata']) expect(inbox.requests[0][key]).toBeUndefined();
    expect(JSON.parse(await readFile(file, 'utf8'))[0]).toEqual(legacy);
    await test.action(legacy.id, 'handled'); const persisted = JSON.parse(await readFile(file, 'utf8'))[0];
    expect(persisted).toMatchObject({ ...legacy, manualStatus: 'handled', events: expect.arrayContaining(legacy.events) }); expect(await readFile(pdf, 'utf8')).toBe('legacy private document');
    expect(test.sent).toHaveLength(1);
  });
  it('rejects invalid, injected, spam and cross-origin inputs and rate limits submissions', async () => {
    const test = await setup();
    expect((await test.call('/api/resume/requests', { name: 'X', email: 'bad', company: 'Y' })).status).toBe(400);
    expect((await test.call('/api/resume/requests', { name: 'X', email: 'x@example.test', company: 'Y' }, { origin: 'https://attacker.test' })).status).toBe(403);
    expect((await test.call('/api/resume/requests', { website: 'spam' })).status).toBe(400);
    expect((await test.call('/api/resume/requests', { name: 'X', email: 'x@example.test\r\nBcc:attacker@example.test', company: 'Y' })).status).toBe(400);
    await test.request(); await test.request(); expect((await test.call('/api/resume/requests', {})).status).toBe(429); expect(test.sent).toHaveLength(2);
  });
  it('fails closed for a malformed store without replacing local history', async () => {
    const test = await setup(); await mkdir(join(test.dataDir, 'resume-access'), { recursive: true }); const file = join(test.dataDir, 'resume-access/requests.json'); await writeFile(file, '[{"id":"legacy-incomplete"}]');
    expect((await test.call('/api/resume/requests', { name: 'X', email: 'x@example.test', company: 'Y' })).status).toBe(500);
    expect(await readFile(file, 'utf8')).toBe('[{"id":"legacy-incomplete"}]'); expect(test.sent).toEqual([]);
  });
});
