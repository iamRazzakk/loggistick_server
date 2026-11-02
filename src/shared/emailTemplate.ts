import {
  ICreateAccount,
  IResetPassword,
  IUserCredentials,
} from "../types/emailTemplate";
import config from "../config";

const BRAND_NAME = "LOGISS";
const BRAND_LOGO =
  "https://res.cloudinary.com/dnsktebcu/image/upload/v1789443746/logo_1_w0yohk.png";
const BRAND_COLOR = "#1E4A8C";

const logoHtml = `
    <img src="${BRAND_LOGO}" alt="${BRAND_NAME} Logo" style="display: block; margin: 0 auto 20px; width:150px" />
`;

const footerHtml = `
    <p style="color: #999; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</p>
`;

const createAccount = (values: ICreateAccount) => {
  const data = {
    to: values.email,
    subject: `Verify your ${BRAND_NAME} account`,
    html: `
            <body style="font-family: Arial, sans-serif; background-color: #f9f9f9; margin: 50px; padding: 20px; color: #555;">
                <div style="width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">

                    ${logoHtml}

                    <h2 style="color: ${BRAND_COLOR}; font-size: 24px; margin-bottom: 20px;">Hey, ${values.name}!</h2>

                    <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">Thank you for signing up for ${BRAND_NAME}. Please verify your email address to activate your account.</p>

                    <div style="text-align: center;">
                        <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">Your single use code is:</p>
                        <div style="background-color: ${BRAND_COLOR}; width: 120px; padding: 10px; text-align: center; border-radius: 8px; color: #fff; font-size: 25px; letter-spacing: 2px; margin: 20px auto;">${values.otp}</div>
                        <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">This code is valid for 3 minutes.</p>
                    </div>

                    <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">If you did not sign up for ${BRAND_NAME}, please ignore this email.</p>
                    ${footerHtml}

                </div>
            </body>
        `,
  };

  return data;
};

const resetPassword = (values: IResetPassword) => {
  const data = {
    to: values.email,
    subject: `Reset your ${BRAND_NAME} password`,
    html: `
            <body style="font-family: Arial, sans-serif; background-color: #f9f9f9; margin: 50px; padding: 20px; color: #555;">
                <div style="width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">

                    ${logoHtml}

                    <h2 style="color: ${BRAND_COLOR}; font-size: 24px; margin-bottom: 20px;">Reset your password</h2>

                    <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">Use the code below to reset your ${BRAND_NAME} password.</p>

                    <div style="text-align: center;">
                        <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">Your single use code is:</p>
                        <div style="background-color: ${BRAND_COLOR}; width: 120px; padding: 10px; text-align: center; border-radius: 8px; color: #fff; font-size: 25px; letter-spacing: 2px; margin: 20px auto;">${values.otp}</div>
                        <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">This code is valid for 3 minutes.</p>
                    </div>

                    <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">If you did not request a password reset, please ignore this email.</p>
                    ${footerHtml}

                </div>
            </body>
        `,
  };
  return data;
};

const userCredentials = (values: IUserCredentials) => {
  const downloadAppUrl = values.downloadAppUrl || config.app.downloadUrl;
  const data = {
    to: values.email,
    subject: `Your ${BRAND_NAME} account credentials`,
    html: `
            <body style="font-family: Arial, sans-serif; background-color: #f9f9f9; margin: 50px; padding: 20px; color: #555;">
                <div style="width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">

                    ${logoHtml}

                    <h2 style="color: ${BRAND_COLOR}; font-size: 24px; margin-bottom: 20px;">Hey, ${values.name}!</h2>

                    <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">Your ${BRAND_NAME} account has been created. Use the credentials below to log in:</p>

                    <div style="background-color: #f6f6f6; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
                        <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 8px 0;"><strong>Email:</strong> ${values.email}</p>
                        <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0;"><strong>Password:</strong> ${values.password}</p>
                    </div>

                    <p style="color: #555; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">For your security, please change this password after you log in.</p>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${downloadAppUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: ${BRAND_COLOR}; color: #fff; text-decoration: none; font-size: 16px; font-weight: bold; padding: 12px 28px; border-radius: 8px;">Download App</a>
                    </div>

                    <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">If you did not expect this email, please contact support.</p>
                    ${footerHtml}

                </div>
            </body>
        `,
  };

  return data;
};

// dispatcher created
const dispatcherCreated = (values: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  middleName: string;
}) => {
  const data = {
    to: values.email,
    subject: `Your ${BRAND_NAME} ${values.middleName} account has been created`,
    html: `
            <body style="font-family: Arial, sans-serif; background-color: #f9f9f9; margin: 50px; padding: 20px; color: #555;">
                <div style="width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">

                    ${logoHtml}

                    <h2 style="color: ${BRAND_COLOR}; font-size: 24px; margin-bottom: 20px;">Hey, ${values.firstName} ${values.lastName}!</h2>

                    <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">Your ${BRAND_NAME} dispatcher account has been created. Your role is ${values.middleName}. Use the credentials below to log in:</p>

                    <div style="background-color: #f6f6f6; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
                        <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 8px 0;"><strong>Email:</strong> ${values.email}</p>
                        <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0;"><strong>Password:</strong> ${values.password}</p>
                    </div>

                    <p style="color: #555; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">For your security, please change this password after you log in.</p>

                    <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">If you did not expect this email, please contact support.</p>
                    ${footerHtml}

            </body>
        `,
  };
  return data;
};

// driver created
const driverCreated = (values: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  middleName: string;
}) => {
  const data = {
    to: values.email,
    subject: `Driver created successfully`,
    html: `
            <body style="font-family: Arial, sans-serif; background-color: #f9f9f9; margin: 50px; padding: 20px; color: #555;">
                <div style="width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">

                    ${logoHtml}

                    <h2 style="color: ${BRAND_COLOR}; font-size: 24px; margin-bottom: 20px;">Hey, ${values.firstName} ${values.middleName ? values.middleName : ""} ${values.lastName}!</h2>

                    <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">Your ${BRAND_NAME} driver account has been created. Use the credentials below to log in:</p>

                    <div style="background-color: #f6f6f6; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
                        <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 8px 0;"><strong>Email:</strong> ${values.email}</p>
                        <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0;"><strong>Password:</strong> ${values.password}</p>
                    </div>

                    <p style="color: #555; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">For your security, please change this password after you log in.</p>

                    <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">If you did not expect this email, please contact support.</p>
                    ${footerHtml}

                </div>
            </body>
        `,
  };
  return data;
};

// report assigned email template
const reportAssigned = (values: {
  email: string;
  name: string;
  reportId: string;
  reportTitle: string;
  reportDescription: string;
  reportStatus: string;
  reportCreatedAt: string;
}) => {
  const statusMap: Record<
    string,
    { bg: string; text: string; border: string }
  > = {
    pending: { bg: "#fffbeb", text: "#b45309", border: "#fde68a" },
    approved: { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" },
    rejected: { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
  };

  const statusStyle = statusMap[values.reportStatus?.toLowerCase()] || {
    bg: "#f1f5f9",
    text: "#475569",
    border: "#cbd5e1",
  };

  const data = {
    to: values.email,
    subject: `Report assigned to you`,
    html: `
      <body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f6f8; padding: 40px 16px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06); border: 1px solid #e5e7eb;">
                
                <!-- Brand Header -->
                <tr>
                  <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #f0f2f5;">
                    ${logoHtml}
                    <div style="display: inline-block; background-color: #eef2ff; color: ${BRAND_COLOR}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 5px 12px; border-radius: 20px; margin-top: 6px;">
                      Report Notification
                    </div>
                  </td>
                </tr>

                <!-- Content Area -->
                <tr>
                  <td style="padding: 32px 32px 24px 32px;">
                    <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px; font-weight: 700; line-height: 1.4;">
                      Hey ${values.name},
                    </h2>
                    <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.6;">
                      A report has been assigned or updated under your account. Please review the details below:
                    </p>

                    <!-- SaaS Meta Table -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 24px; border-collapse: separate; border-spacing: 0; overflow: hidden;">
                      <tr>
                        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; width: 35%; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                          Report ID
                        </td>
                        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 700; font-family: 'SFMono-Regular', Consolas, Menlo, monospace; color: ${BRAND_COLOR};">
                          ${values.reportId}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                          Reason / Title
                        </td>
                        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; color: #1e293b;">
                          ${values.reportTitle}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                          Status
                        </td>
                        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0;">
                          <span style="display: inline-block; padding: 4px 10px; font-size: 12px; font-weight: 600; text-transform: capitalize; border-radius: 6px; background-color: ${statusStyle.bg}; color: ${statusStyle.text}; border: 1px solid ${statusStyle.border};">
                            ${values.reportStatus}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 14px 18px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                          Created At
                        </td>
                        <td style="padding: 14px 18px; font-size: 14px; color: #475569;">
                          ${values.reportCreatedAt}
                        </td>
                      </tr>
                    </table>

                    <!-- Note / Message Callout -->
                    ${
                      values.reportDescription
                        ? `
                    <div style="background-color: #f0f7ff; border-left: 4px solid ${BRAND_COLOR}; border-radius: 0 8px 8px 0; padding: 16px; margin-bottom: 24px;">
                      <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: ${BRAND_COLOR};">
                        Latest Internal Note / Message:
                      </p>
                      <p style="margin: 0; font-size: 14px; color: #1e293b; line-height: 1.6; white-space: pre-wrap;">
                        ${values.reportDescription}
                      </p>
                    </div>`
                        : ""
                    }

                    <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.5;">
                      Please log in to the dashboard to inspect complete details, attached documents, or update the investigation status.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #fafbfc; padding: 24px 32px; text-align: center; border-top: 1px solid #f0f2f5;">
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                      This is an automated notification from ${BRAND_NAME}. If you did not expect this email, please contact support.
                    </p>
                    ${footerHtml}
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    `,
  };
  return data;
};

export const emailTemplate = {
  createAccount,
  resetPassword,
  userCredentials,
  dispatcherCreated,
  driverCreated,
  reportAssigned,
};
