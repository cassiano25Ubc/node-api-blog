import nodemailer from 'nodemailer';
import type { Mailer, MailMessage } from './mailer.js';

export class NodemailerMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'localhost',
      port: Number(process.env.SMTP_PORT ?? 1025),
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });

    try {
      await transport.sendMail({
        from: process.env.MAIL_FROM ?? 'Blog <no-reply@blog.local>',
        ...message,
      });
    } finally {
      transport.close();
    }
  }
}
