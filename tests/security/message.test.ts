// Security #5: chat read/send only for participants; realtime only to them.
const chat = { _id: "c1", participants: ["u1", "u2"] };
jest.mock("../../src/app/modules/chat/chat.model", () => ({
  Chat: { findById: () => ({ select: () => ({ lean: async () => chat }) }) },
}));
const created: any[] = [];
jest.mock("../../src/app/modules/message/message.model", () => ({
  Message: {
    create: jest.fn(async (doc: any) => (created.push(doc), doc)),
    find: () => ({ sort: async () => [] }),
  },
}));
jest.mock("../../src/helpers/socketHelper", () => ({
  userRoom: (id: string) => `user:${id}`,
}));

import { MessageService } from "../../src/app/modules/message/message.service";

const chatId = "64b7f0c2a1b2c3d4e5f60718";
const emitted: any[] = [];
(global as any).io = {
  to: (rooms: string[]) => ({
    emit: (ev: string) => emitted.push({ rooms, ev }),
  }),
};

describe("chat messages", () => {
  it("outsider can't read a chat", async () => {
    await expect(
      MessageService.getMessageFromDB(chatId, { id: "u9", role: "USER" }),
    ).rejects.toThrow("not a participant");
  });

  it("outsider can't send into a chat", async () => {
    await expect(
      MessageService.sendMessageToDB(
        { chatId, text: "hi" },
        { id: "u9", role: "DRIVER" },
      ),
    ).rejects.toThrow("not a participant");
  });

  it("participant sends: sender from token, receiver inside chat, emit only to participants", async () => {
    await MessageService.sendMessageToDB(
      { chatId, text: "hi", sender: "u2", receiver: "u9", extra: 1 },
      { id: "u1", role: "USER" },
    );
    expect(created[0]).toEqual({
      chatId,
      sender: "u1",
      receiver: "u2",
      text: "hi",
      image: undefined,
    });
    expect(emitted[0]).toEqual({
      rooms: ["user:u1", "user:u2"],
      ev: `getMessage::${chatId}`,
    });
  });

  it("support staff can read any chat", async () => {
    await expect(
      MessageService.getMessageFromDB(chatId, { id: "a1", role: "SUPER_ADMIN" }),
    ).resolves.toEqual([]);
  });

  it("invalid chat id is rejected", async () => {
    await expect(
      MessageService.getMessageFromDB("x", { id: "u1", role: "USER" }),
    ).rejects.toThrow("Invalid chat id");
  });
});
