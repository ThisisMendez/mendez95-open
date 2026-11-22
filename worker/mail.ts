import { body, fail, json, requireOrigin, textField, validEmail, type Env } from './env';
import { owner } from './security';
import { Repository } from './storage';
import type { MailTransport, MailMessage } from '../server/mail';
export const RECIPIENT = 'owner@example.invalid';
/** No SMTP, executable or dynamic envelope in the Worker runtime. */
export function mailTransport(env: Env): MailTransport {
    const configured = Boolean(env.EMAIL && env.MAIL_VERIFIED === 'true' && validEmail(env.MAIL_FROM));
    return { configured, async send(message: MailMessage) { if (!configured || message.to !== RECIPIENT || !validEmail(message.replyTo) || /[\r\n]/.test(message.subject))
            throw Error('Mail unavailable.'); await Promise.race([env.EMAIL!.send({ to: RECIPIENT, from: env.MAIL_FROM!, replyTo: message.replyTo, subject: message.subject, text: message.text }), new Promise((_, reject) => setTimeout(() => reject(Error('Mail outcome uncertain.')), 8000))]); } };
}
const ownerRecord = (v: any) => ({ id: v.id, name: v.name, email: v.email, company: v.company, reason: v.reason, requestedAt: v.requestedAt, status: v.manualStatus ?? (['handled', 'archived'].includes(v.status) ? v.status : 'pending'), notification: v.notification, events: (v.events || []).map(({ at, action }: {
        at: string;
        action: string;
    }) => ({ at, action })), ...(!['pending', 'handled', 'archived'].includes(v.status) ? { legacyStatus: v.status } : {}) });
async function notification(env: Env, id: string, mail: MailTransport) {
    const row = await env.DB.prepare('SELECT json,notification FROM requests WHERE id=?').bind(id).first<{
        json: string;
        notification: string;
    }>();
    if (!row)
        fail(404, 'Request not found.');
    if (['sent', 'sending', 'unknown'].includes(row.notification))
        fail(409, 'The notification is accepted, in progress, or uncertain. Check the mailbox before any manual retry.');
    if (!mail.configured) {
        await env.DB.prepare("UPDATE requests SET notification='unconfigured',json=json_set(json,'$.notification','unconfigured') WHERE id=? AND notification NOT IN ('sent','sending','unknown')").bind(id).run();
        return 'unconfigured';
    }
    const attempt = await env.DB.prepare("INSERT INTO notifications(id,request_id,created_at,state,attempt) SELECT ?,?,?,'sending',(SELECT count(*)+1 FROM notifications WHERE request_id=?) WHERE (SELECT count(*) FROM notifications WHERE request_id=?)<3 AND EXISTS(SELECT 1 FROM requests WHERE id=? AND notification NOT IN ('sent','sending','unknown')) RETURNING id").bind(crypto.randomUUID(), id, new Date().toISOString(), id, id, id).first<{
        id: string;
    }>();
    if (!attempt)
        fail(409, 'Notification retry limit reached.');
    // One conditional claim owns sending; another isolate must never send this request too.
    const claimed = await env.DB.prepare("UPDATE requests SET notification='sending',json=json_set(json,'$.notification','sending') WHERE id=? AND notification NOT IN ('sent','sending','unknown') RETURNING id").bind(id).first();
    if (!claimed) {
        await env.DB.prepare("UPDATE notifications SET state='not-sent' WHERE id=?").bind(attempt.id).run();
        fail(409, 'Notification already claimed.');
    }
    const item = JSON.parse(row.json);
    let state = 'unknown';
    try {
        await mail.send({ to: RECIPIENT, replyTo: item.email, subject: 'Mendez 95: Resume request', text: `A visitor requested your full resume. Reply manually by email with the appropriate document.\n\nName: ${item.name}\nCompany: ${item.company}\nEmail: ${item.email}\nReason: ${item.reason || '(not provided)'}\nRequested (UTC): ${item.requestedAt}\nRequest ID: ${item.id}\n\nThis notification sends nothing to the requester. Sign in at /editor for the private inbox.` });
        state = 'sent';
    }
    catch { /* Never blindly retry an uncertain provider outcome. */ }
    const event = JSON.stringify({ at: new Date().toISOString(), action: `notification-${state}` });
    await env.DB.batch([env.DB.prepare("UPDATE requests SET notification=?,json=json_set(json,'$.notification',?,'$.events[#]',json(?)) WHERE id=?").bind(state, state, event, id), env.DB.prepare('UPDATE notifications SET state=? WHERE id=?').bind(state, attempt.id)]);
    return state;
}
export async function mailRoute(r: Request, env: Env, repo: Repository, mail: MailTransport = mailTransport(env)): Promise<Response | null> {
    const p = new URL(r.url).pathname;
    if (p === '/api/contact/status' && r.method === 'GET')
        return json({ available: mail.configured });
    if (p === '/api/resume/status' && r.method === 'GET')
        return json({ emailAvailable: mail.configured });
    if ((p === '/api/contact' || p === '/api/resume/requests') && r.method === 'POST') {
        requireOrigin(r);
        const b = await body(r);
        await repo.limit(r, p, 5, 900000);
        if (b.website)
            fail(400, 'Unable to accept this submission.');
        const name = textField(b.name, 100), email = textField(b.email, 254);
        if (!name || !validEmail(email) || /[\r\n]/.test(name))
            fail(400, 'Enter your name and a valid email address.');
        if (p === '/api/contact') {
            const message = textField(b.message, 5000);
            if (!message)
                fail(400, 'Enter a message of up to 5,000 characters.');
            if (!mail.configured)
                fail(503, 'The email form is not connected yet. Please use the email link below. Your message was not sent.');
            try {
                await mail.send({ to: RECIPIENT, replyTo: email, subject: 'Mendez 95: Portfolio contact', text: `Name: ${name}\nFrom: ${email}\n\n${message}` });
                return json({ message: 'Your message has been accepted for email delivery. Thank you for getting in touch.' });
            }
            catch {
                return json({ error: 'Email delivery could not be confirmed. Please check before retrying or use the email link below.' }, 502);
            }
        }
        const company = textField(b.company, 150), reason = textField(b.reason ?? '', 2000);
        if (!company || reason === null || /[\r\n]/.test(company))
            fail(400, 'Enter your company and an optional reason under 2,000 characters.');
        const id = crypto.randomUUID(), now = new Date().toISOString(), item = { id, name, email, company, reason, requestedAt: now, status: 'pending', notification: 'pending', events: [{ at: now, action: 'requested' }] };
        const saved = await env.DB.prepare("INSERT INTO requests SELECT ?,?,'pending','pending',? WHERE (SELECT count(*) FROM requests)<10000").bind(id, now, JSON.stringify(item)).run();
        if (!saved.meta.changes)
            fail(503, 'Requests are temporarily unavailable. Please contact Jordan by email.');
        const state = await notification(env, id, mail);
        return json({ message: state === 'sent' ? 'Your request is saved and the notification was accepted for email delivery. Jordan can follow up with you directly by email.' : 'Your request is saved in the private inbox, but email delivery is not confirmed. Jordan can review it there and follow up directly by email.', notificationSent: state === 'sent', notification: state }, 201);
    }
    if (p === '/api/owner/resume/requests' && r.method === 'GET') {
        await owner(r, env);
        const rows = (await env.DB.prepare('SELECT json FROM requests ORDER BY created_at DESC LIMIT 10000').all<{
            json: string;
        }>()).results;
        return json({ requests: rows.map(v => ownerRecord(JSON.parse(v.json))), emailAvailable: mail.configured });
    }
    const m = p.match(/^\/api\/owner\/resume\/requests\/([^/]+)\/(notify|handled|archive|reopen)$/);
    if (m && r.method === 'POST') {
        await owner(r, env, true);
        if (m[2] === 'notify') {
            const state = await notification(env, m[1], mail);
            if (state !== 'sent')
                return json({ error: 'Email is not configured or delivery is uncertain. The request remains saved.' }, 503);
        }
        else {
            const status = m[2] === 'handled' ? 'handled' : m[2] === 'archive' ? 'archived' : 'pending';
            const result = await env.DB.prepare("UPDATE requests SET status=?,json=json_set(json,'$.manualStatus',?,'$.events[#]',json(?)) WHERE id=?").bind(status, status, JSON.stringify({ at: new Date().toISOString(), action: `manually-marked-${status}` }), m[1]).run();
            if (!result.meta.changes)
                fail(404, 'Request not found.');
        }
        const row = await env.DB.prepare('SELECT json FROM requests WHERE id=?').bind(m[1]).first<{
            json: string;
        }>();
        return json({ code: 200, request: ownerRecord(JSON.parse(row!.json)) });
    }
    return null;
}
