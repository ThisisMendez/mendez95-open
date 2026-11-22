import { beforeEach, describe, expect, it, vi } from 'vitest';
const smtp = vi.hoisted(() => ({ sendMail: vi.fn(), createTransport: vi.fn() }));
vi.mock('nodemailer', () => ({ createTransport: smtp.createTransport }));
import { createMailTransport } from './mail';
const config = { MENDEZ_OS_MAIL_TRANSPORT: 'gmail', MENDEZ_OS_MAIL_FROM: 'owner@example.test', MENDEZ_OS_GMAIL_USER: 'owner@example.test', MENDEZ_OS_GMAIL_AUTH: 'app-password', MENDEZ_OS_GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' };
const message = { to: 'recipient@example.test', replyTo: 'visitor@example.test', subject: 'Test notification', text: 'Test only' };
beforeEach(() => { vi.clearAllMocks(); smtp.createTransport.mockReturnValue({ sendMail: smtp.sendMail }); smtp.sendMail.mockResolvedValue({ accepted: [message.to], rejected: [] }); });
describe('Gmail adapter with mocked Nodemailer (no SMTP)', () => {
  it('requires explicit complete configuration, with no startup delivery or verification', () => {
    for (const env of [{}, { ...config, MENDEZ_OS_MAIL_TRANSPORT: '' }, { ...config, MENDEZ_OS_GMAIL_AUTH: '' }, { ...config, MENDEZ_OS_GMAIL_APP_PASSWORD: '' }, { ...config, MENDEZ_OS_MAIL_FROM: 'visitor@example.test' }, { ...config, MENDEZ_OS_GMAIL_USER: 'bad\r\naddress' }]) expect(createMailTransport(env).configured).toBe(false);
    expect(smtp.createTransport).not.toHaveBeenCalled();
    expect(createMailTransport(config).configured).toBe(true); expect(smtp.sendMail).not.toHaveBeenCalled();
  });
  it('uses Gmail TLS, bounded SMTP timeouts, fixed envelope, and validated Reply-To', async () => {
    const mail = createMailTransport(config); await mail.send(message);
    expect(smtp.createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: 'smtp.gmail.com', port: 465, secure: true, tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000, dnsTimeout: 10000, disableFileAccess: true, disableUrlAccess: true, auth: { user: config.MENDEZ_OS_GMAIL_USER, pass: 'abcdefghijklmnop' } }));
    expect(smtp.sendMail).toHaveBeenCalledWith({ ...message, from: config.MENDEZ_OS_MAIL_FROM, envelope: { from: config.MENDEZ_OS_MAIL_FROM, to: [message.to] } });
    await expect(mail.send({ ...message, replyTo: 'x\r\nBcc: attacker@example.test' })).rejects.toThrow('Invalid email envelope');
    await expect(mail.send({ ...message, subject: 'x\nBcc: attacker' })).rejects.toThrow('Invalid email envelope');
    expect(smtp.sendMail).toHaveBeenCalledTimes(1);
  });
  it('supports OAuth2 server credentials and fails closed for incomplete OAuth2', () => {
    const env = { ...config, MENDEZ_OS_GMAIL_AUTH: 'oauth2', MENDEZ_OS_GMAIL_APP_PASSWORD: '', MENDEZ_OS_GMAIL_CLIENT_ID: 'test-id', MENDEZ_OS_GMAIL_CLIENT_SECRET: 'test-secret', MENDEZ_OS_GMAIL_REFRESH_TOKEN: 'test-refresh' };
    expect(createMailTransport({ ...env, MENDEZ_OS_GMAIL_REFRESH_TOKEN: '' }).configured).toBe(false);
    expect(createMailTransport(env).configured).toBe(true);
    expect(smtp.createTransport).toHaveBeenCalledWith(expect.objectContaining({ auth: { type: 'OAuth2', user: env.MENDEZ_OS_GMAIL_USER, clientId: 'test-id', clientSecret: 'test-secret', refreshToken: 'test-refresh' } }));
  });
  it('never leaks transport details or reports rejected recipient acceptance', async () => {
    const mail = createMailTransport(config); smtp.sendMail.mockRejectedValueOnce(new Error('Secret transport diagnostics'));
    await expect(mail.send(message)).rejects.toThrow('Email delivery could not be confirmed.');
    smtp.sendMail.mockResolvedValueOnce({ accepted: [], rejected: [message.to] }); await expect(mail.send(message)).rejects.toThrow('Email delivery could not be confirmed.');
    await expect(createMailTransport({}).send(message)).rejects.toThrow('Email is not configured.');
  });
  it('preserves explicit sendmail configuration', () => {
    expect(createMailTransport({ MENDEZ_OS_MAIL_TRANSPORT: 'sendmail', MENDEZ_OS_MAIL_FROM: 'owner@example.test', MENDEZ_OS_SENDMAIL_PATH: '/usr/sbin/sendmail' }).configured).toBe(true);
    expect(createMailTransport({ MENDEZ_OS_MAIL_TRANSPORT: 'sendmail', MENDEZ_OS_MAIL_FROM: 'owner@example.test', MENDEZ_OS_SENDMAIL_PATH: 'relative' }).configured).toBe(false);
    expect(smtp.createTransport).not.toHaveBeenCalled();
  });
});
