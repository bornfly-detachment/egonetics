const { Resend } = require('resend');

const EMAIL_FROM = process.env.EMAIL_FROM || 'Egonetics <onboarding@resend.dev>';

let resendClient = null;

function getClient() {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      return null;
    }
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

async function sendVerificationCode(email, code) {
  const client = getClient();
  if (!client) {
    // Dev mode: print code to console instead of sending email
    console.log(`[DEV EMAIL] To: ${email} | Code: ${code}`);
    return { success: true, devMode: true };
  }

  const { data, error } = await client.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: 'Egonetics 邮箱验证码',
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                  max-width:480px;margin:0 auto;padding:40px 24px;background:#fff;">
        <h2 style="font-size:20px;font-weight:600;color:#111;margin:0 0 16px">
          Egonetics 邮箱验证
        </h2>
        <p style="color:#555;margin:0 0 24px;line-height:1.6">
          您正在注册 Egonetics 账号，请使用以下验证码完成验证：
        </p>
        <div style="background:#f4f4f5;border-radius:10px;padding:28px;
                    text-align:center;margin:0 0 24px">
          <span style="font-size:40px;font-weight:700;letter-spacing:12px;
                       color:#111;font-variant-numeric:tabular-nums">
            ${code}
          </span>
        </div>
        <p style="color:#888;font-size:13px;line-height:1.6;margin:0 0 8px">
          验证码 <strong>10 分钟</strong>内有效，请勿分享给他人。
        </p>
        <p style="color:#aaa;font-size:12px;margin:0">如非本人操作，请忽略此邮件。</p>
      </div>
    `,
  });

  if (error) {
    console.error('Resend error:', error);
    throw new Error('邮件发送失败，请稍后重试');
  }

  return { success: true, id: data?.id };
}

module.exports = { sendVerificationCode };
