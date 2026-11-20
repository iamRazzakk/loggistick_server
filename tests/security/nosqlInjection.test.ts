// NoSQL injection: global operator stripping, booking ownership,
// driver-rating ownership.
import { stripMongoOperators } from "../../src/app/middlewares/sanitizeMongo";
import sanitizeMongo from "../../src/app/middlewares/sanitizeMongo";
import { parseBody } from "../../src/util/parse";

describe("stripMongoOperators", () => {
  it("removes $-keys at any depth (body / update operators)", () => {
    const body = {
      email: { $ne: null },
      $set: { price: 0, role: "SUPER_ADMIN" },
      $where: "sleep(1000)",
      nested: { a: [{ $gt: 1, ok: 2 }], deep: { $regex: ".*" } },
      name: "Ali",
    };
    expect(stripMongoOperators(body)).toEqual({
      email: {},
      nested: { a: [{ ok: 2 }], deep: {} },
      name: "Ali",
    });
  });

  it("removes prototype-pollution keys", () => {
    const body = JSON.parse('{"__proto__":{"isAdmin":true},"constructor":{"x":1},"a":1}');
    const clean = stripMongoOperators(body);
    expect(Object.keys(clean)).toEqual(["a"]);
    expect(({} as any).isAdmin).toBeUndefined();
  });

  it("keeps normal data, dates and buffers", () => {
    const d = new Date();
    const buf = Buffer.from("x");
    expect(stripMongoOperators({ a: "x$y", b: [1, "$2"], d, buf })).toEqual({
      a: "x$y",
      b: [1, "$2"],
      d,
      buf,
    });
  });

  it("middleware cleans req.body and req.query", (done) => {
    const req: any = {
      body: { $set: { x: 1 }, y: 2 },
      query: { password: { $regex: "^a" }, status: "ok" },
      params: {},
    };
    sanitizeMongo(req, {} as any, () => {
      expect(req.body).toEqual({ y: 2 });
      expect(req.query).toEqual({ password: {}, status: "ok" });
      done();
    });
  });

  it("parseBody (multipart `data` JSON) can't bring operators back", () => {
    const out = parseBody({
      data: '{"role":"USER","$set":{"role":"SUPER_ADMIN"},"x":{"$ne":1}}',
    });
    expect(out).toEqual({ role: "USER", x: {} });
  });
});
