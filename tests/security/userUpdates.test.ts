// Security #2, #3, #7: profile update whitelist, driver creation role,
// dispatcher scope escalation.
const findOneAndUpdate = jest.fn(async (_q: any, doc: any) => doc);
const create = jest.fn(async (doc: any) => ({ _id: "new1", ...doc }));
const isExistUserById = jest.fn();
jest.mock("../../src/app/modules/user/user.model", () => ({
  User: {
    findOneAndUpdate: (...a: any[]) => (findOneAndUpdate as any)(...a),
    create: (...a: any[]) => (create as any)(...a),
    isExistUserById: (...a: any[]) => isExistUserById(...a),
  },
}));
jest.mock("../../src/queue/email.queue", () => ({ emailQueue: { add: jest.fn() } }));
jest.mock("../../src/redis/redis.service", () => ({ redisService: { post: jest.fn() } }));
jest.mock("../../src/shared/emailTemplate", () => ({
  emailTemplate: new Proxy({}, { get: () => () => ({ to: "x", subject: "s", html: "h" }) }),
}));
const allowed = new Set<string>(["/drivers", "/staff"]);
jest.mock("../../src/helpers/dispatcherRouteCache", () => ({
  getDispatcherAllowedSet: jest.fn(async () => allowed),
  setDispatcherRoutes: jest.fn(),
}));

import { UserService } from "../../src/app/modules/user/user.service";

beforeEach(() => jest.clearAllMocks());

describe("#2 profile update", () => {
  it("ignores role / verified / email / password / ban flags", async () => {
    isExistUserById.mockResolvedValue({ role: "USER" });
    await UserService.updateProfileToDB({ id: "u1", role: "USER" } as any, {
      firstName: "New",
      role: "SUPER_ADMIN",
      verified: true,
      isBanned: false,
      isAdminVerifiedDriver: true,
      email: "evil@x.com",
      password: "x",
      accessScope: ["/staff"],
    } as any);
    expect(findOneAndUpdate.mock.calls[0][1]).toEqual({ firstName: "New" });
  });

  it("dispatcher can't change middleName (role label)", async () => {
    isExistUserById.mockResolvedValue({ role: "DISPATCHER" });
    await UserService.updateProfileToDB({ id: "d1" } as any, {
      middleName: "Super Admin",
      lastName: "L",
    } as any);
    expect(findOneAndUpdate.mock.calls[0][1]).toEqual({ lastName: "L" });
  });
});

describe("#3 admin driver creation", () => {
  it("always creates a DRIVER, never the role from the body", async () => {
    await UserService.createDriverAsAdminIntoDB({
      firstName: "D",
      role: "SUPER_ADMIN",
      accessScope: ["/staff"],
      driverData: { licenseNumber: "L", evil: 1 },
    } as any);
    const doc = create.mock.calls[0][0];
    expect(doc.role).toBe("DRIVER");
    expect(doc).not.toHaveProperty("accessScope");
    expect(doc.driverData).toEqual({ licenseNumber: "L" });
  });
});

describe("#7 dispatcher scope escalation", () => {
  const dispatcher = { id: "d1", role: "DISPATCHER" };

  it("dispatcher can't grant routes they don't have", async () => {
    await expect(
      UserService.createDispatcherAsAdminIntoDB(
        { accessScope: ["/drivers", "/finance"] } as any,
        dispatcher as any,
      ),
    ).rejects.toThrow("/finance");
    expect(create).not.toHaveBeenCalled();
  });

  it("dispatcher can't change their own scope", async () => {
    await expect(
      UserService.updateDispatcherRoutesIntoDB("d1", ["/drivers"], dispatcher as any),
    ).rejects.toThrow("own access scope");
  });

  it("dispatcher can grant a subset of their routes", async () => {
    await UserService.createDispatcherAsAdminIntoDB(
      { accessScope: ["/drivers"], email: "a@b.com" } as any,
      dispatcher as any,
    );
    expect(create.mock.calls[0][0].accessScope).toEqual(["/drivers"]);
  });
});
