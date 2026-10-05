import { Model } from "mongoose";
import { Types } from "mongoose";

export type IPayment = {
  bookingId: Types.ObjectId;
  price: number;
  paymentStatus: "pending" | "paid" | "failed";
  userId: Types.ObjectId;
  txnNumber: string;
};

export type PaymentModel = Model<IPayment>;
