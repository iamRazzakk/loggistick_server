// Security #1: public signup must not allow choosing an admin role or
// pre-verified / pre-approved flags.
jest.mock("../../src/app/modules/user/user.model", () => ({
  User: { create: jest.fn(async (doc: any) => ({ _id: "u1", ...doc })) },
}));
jest.mock("../../src/queue/email.queue", () => ({
  emailQueue: { add: jest.fn() },
}));
jest.mock("../../src/redis/redis.service", () => ({
  redisService: { post: jest.fn() },
}));
jest.mock("../../src/shared/emailTemplate", () => ({
  emailTemplate: {
    createAccount: () => ({ to: "x", subject: "s", html: "h" }),
  },
}));

import { UserService } from "../../src/app/modules/user/user.service";
import { User } from "../../src/app/modules/user/user.model";

const base = {
  firstName: "A",
  lastName: "B",
  email: "a@b.com",
  password: "12345678",
  contact: "+15550000000",
  dateOfBirth: new Date("1990-01-01"),
};

describe("public signup (createUserToDB)", () => {
  it.each(["SUPER_ADMIN", "DISPATCHER", undefined, "admin"])(
    "rejects role %p",
    async (role) => {
      await expect(
        UserService.createUserToDB({ ...base, role } as any),
      ).rejects.toThrow("Role must be USER or DRIVER");
      expect(User.create).not.toHaveBeenCalled();
    },
  );

  it("drops privileged fields from the body", async () => {
    await UserService.createUserToDB({
      ...base,
      role: "DRIVER",
      verified: true,
      isAdminVerifiedDriver: true,
      isBanned: false,
      applicationStatus: "approved",
      accessScope: ["/riders"],
      stripeCustomerId: "cus_x",
      driverData: { licenseNumber: "L1", hacked: true },
    } as any);

    const saved = (User.create as jest.Mock).mock.calls[0][0];
    expect(saved).toMatchObject({ ...base, role: "DRIVER" });
    expect(saved.driverData).toEqual({ licenseNumber: "L1" });
    for (const key of [
      "verified",
      "isAdminVerifiedDriver",
      "isBanned",
      "applicationStatus",
      "accessScope",
      "stripeCustomerId",
    ]) {
      expect(saved).not.toHaveProperty(key);
    }
  });

  it("allows a normal rider signup", async () => {
    await UserService.createUserToDB({ ...base, role: "USER" } as any);
    expect(User.create).toHaveBeenCalledWith({ ...base, role: "USER" });
  });
});
