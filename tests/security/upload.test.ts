// Security #8: uploads only keep allowed extensions; size limit per route.
let captured: any;
jest.mock("multer", () => {
  const m: any = (opts: any) => {
    captured = opts;
    return { fields: () => "mw" };
  };
  m.diskStorage = (o: any) => o;
  return { __esModule: true, default: m };
});

import { getUploadFields } from "../../src/app/middlewares/fileUploaderHandlar";

const check = (fieldname: string, originalname: string, mimetype: string) =>
  new Promise<string>((resolve) =>
    captured.fileFilter({}, { fieldname, originalname, mimetype }, (err: any) =>
      resolve(err ? "rejected" : "ok"),
    ),
  );

describe("upload filter", () => {
  beforeAll(() => getUploadFields());

  it.each([
    ["image", "x.html", "image/png"],
    ["image", "x.js", "image/png"],
    ["image", "x.svg", "image/png"],
    ["image", "x.json", "application/json"],
    ["driverData.licenseImage", "x.png.html", "image/png"],
    ["doc", "x.html", "text/plain"],
    ["media", "x.html", "video/mp4"],
  ])("rejects %s %s", async (field, name, mime) => {
    expect(await check(field, name, mime)).toBe("rejected");
  });

  it.each([
    ["image", "photo.JPG", "image/jpeg"],
    ["driverData.licenseImage", "lic.png", "image/png"],
    ["file", "zones.geojson", "application/octet-stream"],
    ["doc", "zones.kml", "application/vnd.google-earth.kml+xml"],
    ["doc", "a.pdf", "application/pdf"],
  ])("accepts %s %s", async (field, name, mime) => {
    expect(await check(field, name, mime)).toBe("ok");
  });

  it("saved filename uses a safe name + allowed ext", (done) => {
    captured.storage.filename(
      {},
      { originalname: "../../evil name.PNG" },
      (_e: any, n: string) => {
        // no path parts, lowercased ext, random suffix
        expect(n).toMatch(/^evil-name-\d+-[0-9a-f]{8}\.png$/);
        done();
      },
    );
  });

  it("image-only route gets a 20MB limit, not 500MB", () => {
    getUploadFields(["image", "driverData.licenseImage"]);
    expect(captured.limits.fileSize).toBe(20 * 1024 * 1024);
    getUploadFields();
    expect(captured.limits.fileSize).toBe(500 * 1024 * 1024);
  });
});
