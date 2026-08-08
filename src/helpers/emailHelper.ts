import { emailQueue } from "../queue/email.queue";
import { ISendEmail } from "../types/email";

const sendEmail = async (values: ISendEmail) => {
  // Queue the email instead of sending directly
  await emailQueue.add(
    "send-email",
    {
      to: values.to,
      subject: values.subject,
      html: values.html,
    },
    {
      // Prevent duplicate jobs for same email

      jobId: `email-${values.to}-${values.subject}-${Date.now()}`,
      removeOnComplete: true,
      removeOnFail: false,
    },
  );
};

export const emailHelper = {
  sendEmail,
};
