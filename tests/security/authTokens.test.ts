// Security #6, #10, #11, #13: socket auth, change password, CSRF, tokenVersion.
process.env.JWT_SECRET = "test-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh";
process.env.JWT_ISSUER = "iss";
process.env.JWT_AUDIENCE = "aud";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";

const dbUser: any = {
  _id: "u1",
  role: "USER",
  isBanned: false,
  tokenVersion: 1,
  email: "a@b.com",
};
const findOneAndUpdate = jest.fn();
let passwordDoc: any;
jest.mock("../../src/app/modules/user/user.model", () => ({
  User: {
    findById: () => ({
      select: (s: string) =>
        s.includes("+password")
          ? Promise.resolve(passwordDoc)
          : { lean: async () => dbUser },
    }),
    findOneAndUpdate: (...a: any[]) => findOneAndUpdate(...a),
    isMatchPassword: async (p: string, h: string) =>
      p === "old-pass" && h === "HASH",
  },
}));
jest.mock("../../src/firebase", () => ({ getFirebaseAuth: jest.fn() }));
jest.mock("../../src/app/modules/booking/booking.socket", () => ({
  registerBookingLocationSocket: jest.fn(),
}));

import { jwtHelpers } from "../../src/helpers/jwtHelper";
import auth from "../../src/app/middlewares/auth";
import { socketHelper } from "../../src/helpers/socketHelper";
import { AuthService } from "../../src/app/modules/auth/auth.service";

const runAuth = (req: any) =>
  new Promise<any>((resolve) =>
    auth("USER")(req, {} as any, (err?: any) => resolve(err)),
  );
const tokenFor = (tokenVersion: number) =>
  jwtHelpers.createAccessToken({ id: "u1", role: "USER", tokenVersion });

describe("#13 tokenVersion", () => {
  it("token with the current version passes, older one fails", async () => {
    expect(
      await runAuth({
        headers: { authorization: `Bearer ${tokenFor(1)}` },
        method: "GET",
      }),
    ).toBeUndefined();
    const err = await runAuth({
      headers: { authorization: `Bearer ${tokenFor(0)}` },
      method: "GET",
    });
    expect(err?.message).toMatch(/Session expired/);
  });
});

describe("#11 CSRF for cookie auth", () => {
  it("cookie + POST without X-CSRF-Token is rejected", async () => {
    const err = await runAuth({
      headers: {},
      method: "POST",
      cookies: { access_token: tokenFor(1), csrf_token: "abc" },
    });
    expect(err?.message).toBe("Invalid CSRF token");
  });

  it("matching header passes; GET needs none; Bearer needs none", async () => {
    expect(
      await runAuth({
        headers: { "x-csrf-token": "abc" },
        method: "POST",
        cookies: { access_token: tokenFor(1), csrf_token: "abc" },
      }),
    ).toBeUndefined();
    expect(
      await runAuth({
        headers: {},
        method: "GET",
        cookies: { access_token: tokenFor(1) },
      }),
    ).toBeUndefined();
    expect(
      await runAuth({
        headers: { authorization: `Bearer ${tokenFor(1)}` },
        method: "POST",
      }),
    ).toBeUndefined();
  });
});

describe("#6 socket auth", () => {
  let middleware: any;
  beforeAll(() => {
    socketHelper.socket({
      use: (fn: any) => (middleware = fn),
      on: jest.fn(),
    } as any);
  });
  const connect = (handshake: any) =>
    new Promise<any>((resolve) => {
      const socket: any = {
        handshake: { headers: {}, query: {}, auth: {}, ...handshake },
        data: {},
      };
      middleware(socket, (err?: Error) => resolve({ err, socket }));
    });

  it("rejects a socket without token", async () => {
    expect((await connect({})).err?.message).toMatch(/token required/);
  });

  it("rejects a bad token", async () => {
    expect((await connect({ auth: { token: "nope" } })).err?.message).toMatch(
      /invalid/,
    );
  });

  it("rejects a token from before a password change", async () => {
    expect(
      (await connect({ auth: { token: tokenFor(0) } })).err?.message,
    ).toMatch(/session expired/);
  });

  it("accepts a valid token and sets socket.data.user from it", async () => {
    const { err, socket } = await connect({ auth: { token: tokenFor(1) } });
    expect(err).toBeUndefined();
    expect(socket.data.user).toEqual({ id: "u1", role: "USER" });
  });
});

describe("#10 change password", () => {
  beforeEach(() => {
    passwordDoc = { _id: "u1", password: "HASH" };
    findOneAndUpdate.mockClear();
  });

  it.each([undefined, ""])(
    "rejects missing current password (%p)",
    async (currentPassword) => {
      await expect(
        AuthService.changePasswordToDB({ id: "u1" } as any, {
          currentPassword: currentPassword as any,
          newPassword: "newpass123",
          confirmPassword: "newpass123",
        }),
      ).rejects.toThrow("Current password is required");
      expect(findOneAndUpdate).not.toHaveBeenCalled();
    },
  );

  it("wrong current password is rejected", async () => {
    await expect(
      AuthService.changePasswordToDB({ id: "u1" } as any, {
        currentPassword: "nope",
        newPassword: "newpass123",
        confirmPassword: "newpass123",
      }),
    ).rejects.toThrow("Password is incorrect");
  });

  it("correct current password changes it and bumps tokenVersion", async () => {
    await AuthService.changePasswordToDB({ id: "u1" } as any, {
      currentPassword: "old-pass",
      newPassword: "newpass123",
      confirmPassword: "newpass123",
    });
    expect(findOneAndUpdate.mock.calls[0][1].$inc).toEqual({ tokenVersion: 1 });
  });
});
