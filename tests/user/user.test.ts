import request from "supertest";
import { StatusCodes } from "http-status-codes";
import app from "../../src/app";
import { USER_ROLES } from "../../src/enums/user";
const userData = {
    name: "Md Abdur Razzak Rakib",
    email: `rakib${Date.now()}@gmail.com`,
    password: "password123",
    location: "Dhaka, Bangladesh",
    profile: "/profile.png",
    role: USER_ROLES.USER,
    contact: "+8801609502136"
};

describe("User Model Test", () => {
    it("should create a user successfully", async () => {
        const res = await request(app)
            .post("/api/v1/user")
            .send(userData);
        expect(res.body.success).toBe(true);
        expect(res.status).toBe(StatusCodes.CREATED);
        expect(res.body.message).toContain("Your account has been successfully created. Verify Your Email By OTP. Check your email");
    });
    // if missing required fields

    // it("Should fail to create a user  with missing required fields", async () => {
    //     const res = await request(app)
    //         .post("/api/v1/user")
    //         .send({
    //             name: "Md Abdur Razzak Rakib",
    //             email: `rakib${Date.now()}@gmail.com`,
    //             password: "password123",
    //             location: "Dhaka, Bangladesh",
    //         });
    //     expect(res.body.success).toBe(false);
    //     expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    // })

    // it("Should fail to create a user with invalid email", async () => {
    //     const res = await request(app)
    //         .post("/api/v1/user")
    //         .send({
    //             name: "Md Abdur Razzak Rakib",
    //             email: `rakib${Date.now()}gmail.com`,
    //             password: "password123",
    //             location: "Dhaka, Bangladesh",
    //             role: USER_ROLES.USER,
    //             contact: "+8801609502136"
    //         });
    //     expect(res.body.success).toBe(false);
    //     expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    // })
});