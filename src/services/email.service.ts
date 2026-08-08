import nodemailer from "nodemailer";
import config from "../config";

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: Number(config.email.port),
  pool: true,
  maxConnections: 5,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  await transporter.sendMail({
    from: `From ${config.email.user}`,
    to,
    subject,
    html,
  });
};
