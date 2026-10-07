import {
  ICreateAccount,
  IResetPassword,
  IUserCredentials,
} from "../types/emailTemplate";
import config from "../config";

const BRAND_NAME = "Loggistick";
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
    subject: `Dispatcher created successfully`,
    html: `
            <body style="font-family: Arial, sans-serif; background-color: #f9f9f9; margin: 50px; padding: 20px; color: #555;">
                <div style="width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">

                    ${logoHtml}

                    <h2 style="color: ${BRAND_COLOR}; font-size: 24px; margin-bottom: 20px;">Hey, ${values.firstName} ${values.middleName ? values.middleName : ""} ${values.lastName}!</h2>

                    <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">Your ${BRAND_NAME} dispatcher account has been created. Use the credentials below to log in:</p>

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

export const emailTemplate = {
  createAccount,
  resetPassword,
  userCredentials,
  dispatcherCreated,
};
