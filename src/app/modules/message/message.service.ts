import { JwtPayload } from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";
import { Types } from "mongoose";
import ApiError from "../../../errors/ApiErrors";
import { USER_ROLES } from "../../../enums/user";
import { userRoom } from "../../../helpers/socketHelper";
import { Chat } from "../chat/chat.model";
import { IMessage } from "./message.interface";
import { Message } from "./message.model";

// Admins and dispatchers (with /support scope, checked on the route) can
// read/answer any chat. Riders and drivers only their own chats.
const STAFF_ROLES: string[] = [USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER];

const getChatForUser = async (chatId: unknown, user: JwtPayload) => {
  if (typeof chatId !== "string" || !Types.ObjectId.isValid(chatId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid chat id");
  }
  const chat = await Chat.findById(chatId).select("participants").lean();
  if (!chat) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Chat not found");
  }
  const participantIds = (chat.participants ?? []).map(String);
  const isParticipant = participantIds.includes(String(user.id));
  if (!isParticipant && !STAFF_ROLES.includes(user.role)) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You are not a participant of this chat",
    );
  }
  return { chat, participantIds };
};

const sendMessageToDB = async (
  payload: any,
  user: JwtPayload,
): Promise<IMessage> => {
  const { participantIds } = await getChatForUser(
    String(payload?.chatId ?? ""),
    user,
  );

  // Receiver must be someone else in this chat.
  const receiver =
    payload?.receiver && participantIds.includes(String(payload.receiver))
      ? String(payload.receiver)
      : participantIds.find((id) => id !== String(user.id));
  if (!receiver) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid receiver");
  }

  // Only known fields; sender always comes from the token.
  const response = await Message.create({
    chatId: payload.chatId,
    sender: user.id,
    receiver,
    text: typeof payload?.text === "string" ? payload.text : undefined,
    image: typeof payload?.image === "string" ? payload.image : undefined,
  });

  // Realtime: only to the chat's participants (not every connected socket).
  //@ts-ignore
  const io = global.io;
  if (io) {
    const rooms = participantIds.map(userRoom);
    io.to(rooms).emit(`getMessage::${payload.chatId}`, response);
  }

  return response;
};

const getMessageFromDB = async (
  id: string,
  user: JwtPayload,
): Promise<IMessage[]> => {
  await getChatForUser(id, user);
  const messages = await Message.find({ chatId: id }).sort({ createdAt: -1 });
  return messages;
};

export const MessageService = { sendMessageToDB, getMessageFromDB };
