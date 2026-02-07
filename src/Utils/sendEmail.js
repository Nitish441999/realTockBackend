import nodemailer from "nodemailer";

const sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "nitish44199@gmail.com",
        pass: "mffz xhok ybhi mslm",
      },
    });
    await transporter.sendMail({
      from: `"RealTalk web Application" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error("Email send error:", error.message);
  }
};
export { sendEmail };
