const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendOTP = async (to, otp) => {
  await resend.emails.send({
    from: 'ISAR <onboarding@resend.dev>',
    to,
    subject: 'Your OTP for Password Reset',
    html: `
      <div style="font-family: Arial, sans-serif">
        <h2>Password Reset OTP</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>This OTP will expire in <b>5 minutes</b>.</p>
      </div>
    `,
  });
};

module.exports = sendOTP;