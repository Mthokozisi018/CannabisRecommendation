import "server-only";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function managerInvitationSubject() {
  return "You've been invited to manage a GreenChoice store";
}

export function renderManagerInvitationEmail(actionLink: string) {
  const safeLink = escapeHtml(actionLink);
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta http-equiv="content-type" content="text/html; charset=utf-8" />
    <title>${managerInvitationSubject()}</title>
  </head>
  <body style="margin:0;background:#020706;color:#f7fff4;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020706;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px;border:1px solid #49b51f;border-radius:22px;overflow:hidden;background:linear-gradient(145deg,#07150f,#020706);box-shadow:0 0 35px rgba(103,220,54,.20);">
            <tr>
              <td align="center" style="padding:44px 32px 36px;border-bottom:1px solid #2f8315;">
                <div style="font-size:42px;font-weight:800;line-height:1;color:#fff;">Green<span style="color:#65d52f;">Choice</span></div>
                <div style="margin-top:12px;color:#83e64b;letter-spacing:9px;font-size:14px;font-weight:700;">GREEN CONNECT</div>
              </td>
            </tr>
            <tr>
              <td style="padding:44px 56px;">
                <div style="text-align:center;font-size:46px;line-height:1.2;font-weight:800;color:#fff;">You've been invited to manage a <span style="color:#65d52f;">GreenChoice</span> store</div>
                <div style="width:130px;height:1px;background:#49b51f;margin:30px auto;"></div>
                <p style="font-size:18px;line-height:1.8;margin:0 0 18px;color:#f4fff0;">Hello,</p>
                <p style="font-size:18px;line-height:1.8;margin:0 0 18px;color:#f4fff0;">You've been invited to create a manager account for GreenChoice.</p>
                <p style="font-size:18px;line-height:1.8;margin:0 0 18px;color:#f4fff0;">Your manager account gives you access to set up your store, manage products, manage inventory, manage staff, and serve customers through the GreenChoice platform.</p>
                <p style="font-size:18px;line-height:1.8;margin:0 0 28px;color:#f4fff0;">To continue, accept your invitation and view your one-time temporary login details.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 42px;">
                  <tr>
                    <td align="center" style="border-radius:12px;background:#65dd28;">
                      <a href="${safeLink}" style="display:inline-block;padding:22px 76px;color:#061006;text-decoration:none;font-size:24px;font-weight:800;border-radius:12px;">View Temporary Login</a>
                    </td>
                  </tr>
                </table>
                <div style="font-size:22px;color:#65d52f;font-weight:800;margin-bottom:18px;">What happens next?</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    ${["View temporary login details", "Sign in with the temporary password", "Create your permanent password and complete onboarding", "Access your manager dashboard"].map((item, index) => `
                    <td width="25%" align="center" style="padding:8px;color:#f7fff4;vertical-align:top;">
                      <div style="width:34px;height:34px;border-radius:50%;background:#65d52f;color:#071007;font-weight:800;line-height:34px;margin:0 auto 12px;">${index + 1}</div>
                      <div style="font-size:15px;line-height:1.5;">${item}</div>
                    </td>`).join("")}
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 56px;border-top:1px solid #2f8315;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-size:16px;line-height:1.7;color:#f4fff0;">If you were not expecting this invitation,<br />you can ignore this email.</td>
                    <td align="right" style="color:#65d52f;font-size:22px;font-weight:800;">GreenChoice<br /><span style="font-size:13px;letter-spacing:5px;">GREEN CONNECT</span><br /><span style="font-size:15px;font-weight:400;">Secure. Compliant. Connected.</span></td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
