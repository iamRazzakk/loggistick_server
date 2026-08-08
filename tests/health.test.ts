import request from "supertest";
import app from "../src/app";

describe("Health Routes", () => {
    it("should return the welcome message from root route", async () => {
        const res = await request(app).get("/");
        expect(res.status).toBe(200);
        expect(res.text).toContain("Hey Backend, How can I assist you");
    });
});
