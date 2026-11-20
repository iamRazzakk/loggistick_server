// Security #4 / #12: query-string input must not inject MongoDB operators,
// touch hidden fields, or run as a raw regex.
import QueryBuilder from "../../src/app/builder/queryBuilder";

const fakeQuery = () => {
  const calls: Record<string, any[]> = { find: [], sort: [], select: [] };
  const q: any = {
    find: (f: any) => (calls.find.push(f), q),
    sort: (s: any) => (calls.sort.push(s), q),
    select: (s: any) => (calls.select.push(s), q),
    skip: () => q,
    limit: () => q,
  };
  return { q, calls };
};

describe("QueryBuilder security", () => {
  it("drops operator objects, $-keys and password filters", () => {
    const { q, calls } = fakeQuery();
    new QueryBuilder(q, {
      password: { $regex: "^\$2b" },
      email: { $ne: null },
      $where: "sleep(1000)",
      "password.x": "a",
      tokenVersion: "0",
      status: "active",
      page: "2",
    }).filter();
    expect(calls.find[0]).toEqual({ status: "active" });
  });

  it("turns repeated params into $in of plain values", () => {
    const { q, calls } = fakeQuery();
    new QueryBuilder(q, { status: ["a", "b"] }).filter();
    expect(calls.find[0]).toEqual({ status: { $in: ["a", "b"] } });
  });

  it("builds a numeric price range only", () => {
    const { q, calls } = fakeQuery();
    new QueryBuilder(q, { price: { min: "10", max: { $gt: 1 } } }).filter();
    expect(calls.find[0]).toEqual({ price: { $gte: 10 } });
  });

  it("escapes searchTerm (no regex / ReDoS)", () => {
    const { q, calls } = fakeQuery();
    new QueryBuilder(q, { searchTerm: "(a+)+$" }).search(["name"]);
    const pattern = calls.find[0].$or[0].name.$regex;
    // literal match only: the escaped pattern matches the text itself
    expect(new RegExp(pattern).test("(a+)+$")).toBe(true);
    expect(new RegExp(pattern).test("aaaa")).toBe(false);
  });

  it("ignores non-string searchTerm", () => {
    const { q, calls } = fakeQuery();
    new QueryBuilder(q, { searchTerm: { $ne: "" } }).search(["name"]);
    expect(calls.find).toHaveLength(0);
  });

  it("blocks +password and password in fields/sort", () => {
    const { q, calls } = fakeQuery();
    new QueryBuilder(q, { fields: "+password,name,-password", sort: "password,-createdAt" })
      .fields()
      .sort();
    expect(calls.select[0]).toBe("name");
    expect(calls.sort[0]).toBe("-createdAt");
  });
});
