const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendOTP = async (to, otp) => {
  return resend.emails.send({
    from: 'ISAR <onboarding@resend.dev>',
    to,
    subject: 'Your OTP for Password Reset',
    html: `
      <h2>Password Reset OTP</h2>
      <p>Your OTP is:</p>
      <h1>${otp}</h1>
      <p>This OTP expires in 5 minutes.</p>
    `,
  });
};

module.exports = sendOTP;
