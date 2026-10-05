import { Schema, model } from "mongoose";
import { IPayment, PaymentModel } from "./payment.interface";

const paymentSchema = new Schema<IPayment, PaymentModel>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      required: true,
      default: "pending",
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    txnNumber: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);
paymentSchema.index({ bookingId: 1 }, { unique: true });
paymentSchema.index({ userId: 1 });

export const Payment = model<IPayment, PaymentModel>("Payment", paymentSchema);
