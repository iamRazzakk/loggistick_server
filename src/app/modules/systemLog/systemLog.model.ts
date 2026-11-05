import { model, Schema } from "mongoose";
import { USER_ROLES } from "../../../enums/user";
import { ISystemLog } from "./systemLog.interface";

const changeSchema = new Schema(
  {
    field: { type: String, required: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const systemLogSchema = new Schema<ISystemLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorRole: {
      type: String,
      enum: [USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER],
      required: true,
    },
    actorEmail: { type: String },
    action: {
      type: String,
      enum: ["CREATE", "UPDATE", "DELETE"],
      required: true,
    },
    module: { type: String, required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true, index: true },
    description: { type: String, required: true },
    changes: { type: [changeSchema], default: [] },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true, versionKey: false },
);

systemLogSchema.index({ createdAt: -1 });
systemLogSchema.index({ actorId: 1, createdAt: -1 });
systemLogSchema.index({ module: 1, entityId: 1, createdAt: -1 });

export const SystemLog = model<ISystemLog>("SystemLog", systemLogSchema);
