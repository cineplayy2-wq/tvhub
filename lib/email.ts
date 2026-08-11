import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpUser = (process.env.SMTP_USER || "cineplayy7@gmail.com").trim();
const smtpPass = (process.env.SMTP_PASS || "hmty avjv yvru ebom").replace(/\s+/g, "");
const smtpFrom = process.env.SMTP_FROM || `HUBFLIX <${smtpUser}>`;

function createTransporter(port: number, secure: boolean) {
  return nodemailer.createTransport({
    host: smtpHost,
    port,
    secure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    connectionTimeout: 8000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
    tls: {
      rejectUnauthorized: false,
    },
  });
}

export async function sendOtpEmail(toEmail: string, code: string, userName?: string | null) {
  const greeting = userName ? `Olá, ${userName}!` : "Olá!";

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0c10; color: #ffffff; margin: 0; padding: 40px 20px; }
        .card { max-width: 480px; margin: 0 auto; background-color: #16181f; border-radius: 20px; border: 1px solid rgba(108, 29, 255, 0.4); padding: 40px 32px; text-align: center; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8); }
        .logo { font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: -1px; margin-bottom: 24px; }
        .logo span { color: #6C1DF5; }
        .title { font-size: 22px; font-weight: 800; margin-bottom: 12px; color: #ffffff; }
        .text { font-size: 14px; color: #9a9ea8; line-height: 1.6; margin-bottom: 24px; }
        .otp-box { background: linear-gradient(135deg, rgba(108, 29, 245, 0.25), rgba(79, 70, 229, 0.25)); border: 1.5px solid #6C1DF5; border-radius: 16px; padding: 22px; font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #a78bfa; margin: 28px 0; text-shadow: 0 0 20px rgba(108, 29, 245, 0.6); }
        .footer { font-size: 12px; color: #6b7280; margin-top: 32px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">HUB<span>FLIX</span></div>
        <div class="title">Seu Código de Acesso</div>
        <div class="text">${greeting} Digite o código de 6 dígitos abaixo para acessar sua conta com segurança.</div>
        <div class="otp-box">${code}</div>
        <div class="text">Este código expira em 15 minutos. Se você não solicitou este acesso, ignore esta mensagem.</div>
        <div class="footer">HUBFLIX Streaming Platform · Autenticação Segura</div>
      </div>
    </body>
    </html>
  `;

  console.log(`[HUBFLIX 2FA OTP CODE LOG] E-mail: ${toEmail} | Código: ${code}`);

  try {
    const transporter465 = createTransporter(465, true);
    await transporter465.sendMail({
      from: smtpFrom,
      to: toEmail,
      subject: `${code} é o seu código de acesso HUBFLIX`,
      html,
    });
    console.log(`[SMTP Success] E-mail enviado via porta 465 para ${toEmail}`);
    return;
  } catch (err1) {
    console.warn("[SMTP Warning] Falha na porta 465, tentando 587:", err1);
  }

  try {
    const transporter587 = createTransporter(587, false);
    await transporter587.sendMail({
      from: smtpFrom,
      to: toEmail,
      subject: `${code} é o seu código de acesso HUBFLIX`,
      html,
    });
    console.log(`[SMTP Success] E-mail enviado via porta 587 para ${toEmail}`);
    return;
  } catch (err2) {
    console.error("[SMTP Error] Falha nas portas 465 e 587 ao enviar e-mail:", err2);
  }
}
