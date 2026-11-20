export type IVerifyEmail = {
    email: string;
    oneTimeCode: number;
};

export type ILoginData = {
    email: string;
    password: string;
    fcmToken?: string;
};

export type ISocialLoginData = {
    token: string;
    social_type?: "google" | "apple" | "facebook";
    role?: "USER" | "DRIVER";
    fcmToken?: string;
    name?: string;
    picture?: string;
};

export type IAuthResetPassword = {
    newPassword: string;
    confirmPassword: string;
};

export type IChangePassword = {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
};
  