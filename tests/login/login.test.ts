import request from "supertest";
import app from "../../src/app";
import { StatusCodes } from "http-status-codes";

const userInformation = {
    email: "mdabdurrazzakrakib290@gmail.com",
    password: "StrongPass123",
};

describe("Login Test", () => {
    it("should login successfully", async () => {
        const res = await request(app)
            .post("/api/v1/auth/login")
            .send(userInformation);
        expect(res.body.success).toBe(true);
        expect(res.status).toBe(200);
        expect(res.body.message).toContain("User login successfully");
    })

    it("should fail to login with incorrect password", async () => {
        const res = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email: userInformation.email,
                password: "WrongPassword",
            });
        expect(res.body.success).toBe(false);
        expect(res.status).toBe(StatusCodes.BAD_REQUEST);
        expect(res.body.message).toContain("Password is incorrect!");
    })
    it("should fail to login with incorrect email", async () => {
        const res = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email: "",
                password: "WrongPassword",
            });

        expect(res.body.success).toBe(false);
        expect(res.status).toBe(StatusCodes.BAD_REQUEST);
        expect(res.body.message).toBe("Validation Error");
    })




    it("should fail to login with non-existent email", async () => {
        const res = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email: `notfound${Date.now()}@gmail.com`,
                password: userInformation.password,
            });
        expect(res.body.success).toBe(false);
        expect(res.status).toBe(StatusCodes.BAD_REQUEST);
        expect(res.body.message).toContain("User doesn't exist!");
    })

});