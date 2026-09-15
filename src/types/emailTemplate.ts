export type ICreateAccount = {
    name: string;
    email: string;
    otp: number;
};
  
export type IResetPassword = {
    email: string;
    otp: number;
};

export type IUserCredentials = {
    name: string;
    email: string;
    password: string;
    downloadAppUrl?: string;
};