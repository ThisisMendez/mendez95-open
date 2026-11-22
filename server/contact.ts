import type { Express } from 'express';
import { CONTACT_RECIPIENT, createMailTransport, textField, validEmail, visitorFormGuard, type MailTransport } from './mail';

export function mountContactRoutes(app: Express, mail: MailTransport = createMailTransport()) {
  app.get('/api/contact/status', (_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json({ available: mail.configured }); });
  app.post('/api/contact', visitorFormGuard(), async (req, res) => {
    const name = textField(req.body?.name, 100), message = textField(req.body?.message, 5000), email = textField(req.body?.email, 254);
    if (!name || !message || !validEmail(email) || /[\r\n]/.test(name)) { res.status(400).json({ error: 'Enter your name, a valid email address, and a message (up to 5,000 characters).' }); return; }
    if (!mail.configured) { res.status(503).json({ error: 'The email form is not connected yet. Please use the email link below. Your message was not sent.' }); return; }
    try {
      await mail.send({ to: CONTACT_RECIPIENT, replyTo: email, subject: 'Mendez 95: Portfolio contact', text: `Name: ${name}\nFrom: ${email}\n\n${message}` });
      res.json({ message: 'Your message has been accepted for email delivery. Thank you for getting in touch.' });
    } catch { res.status(502).json({ error: 'Email delivery could not be confirmed. Please try again or use the email link below.' }); }
  });
}
