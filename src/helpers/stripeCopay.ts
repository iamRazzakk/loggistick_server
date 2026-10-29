import Stripe from "stripe";
import { Types } from "mongoose";
import stripe from "../config/stripe";
import config from "../config";
import { User } from "../app/modules/user/user.model";
import { Booking } from "../app/modules/booking/booking.model";
import { Payment } from "../app/modules/payment/payment.model";
import { sendNotifications, sendPushNotification } from "./notificationsHelper";
import { USER_ROLES } from "../enums/user";

export const COPAY_CHARGE = "passenger-copay";

type RiderForStripe = {
  _id: Types.ObjectId;
  email?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  stripeCustomerId?: string;
};

export const stripeId = (value: unknown): string | undefined => {
  if (typeof value === "string" && value) return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id: unknown }).id === "string"
  ) {
    return (value as { id: string }).id;
  }
  return undefined;
};

const riderName = (user: RiderForStripe) =>
  [user.firstName, user.middleName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

export const getOrCreateStripeCustomer = async (user: RiderForStripe) => {
  if (user.stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(user.stripeCustomerId);
      if (!("deleted" in existing && existing.deleted)) {
        return existing.id;
      }
    } catch {
      // Customer is missing in Stripe. Create a new one below.
    }
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: riderName(user) || undefined,
    metadata: { userId: String(user._id) },
  });

  await User.updateOne(
    { _id: user._id },
    { $set: { stripeCustomerId: customer.id } },
  );

  return customer.id;
};

export const saveUserPaymentMethod = async (
  userId: string,
  customerId?: string | null,
  paymentMethodId?: string | null,
) => {
  if (!userId || !customerId) return;

  let pmId = paymentMethodId ?? undefined;
  if (!pmId) {
    const listed = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });
    pmId = listed.data[0]?.id;
  }
  if (!pmId) return;

  try {
    await stripe.paymentMethods.update(pmId, { allow_redisplay: "always" });
  } catch {
    // The card can still be charged even if redisplay cannot be updated.
  }

  try {
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: pmId },
    });
  } catch {
    // Default payment method is best-effort.
  }

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        stripeCustomerId: customerId,
        stripeDefaultPaymentMethodId: pmId,
      },
    },
  );
};

export const finalizePassengerCopay = async (params: {
  bookingId: string;
  txnNumber: string;
}) => {
  const booking = await Booking.findOneAndUpdate(
    { _id: params.bookingId, paymentStatus: { $ne: "paid" } },
    {
      $set: {
        bookingStatus: "completed",
        paymentStatus: "paid",
      },
      $unset: { stripeCheckoutSessionId: 1 },
    },
    { new: true },
  );
  if (!booking) return null;

  await Payment.updateOne(
    { bookingId: booking._id },
    {
      $setOnInsert: {
        bookingId: booking._id,
        price: booking.passengerCoPay ?? booking.price,
        paymentStatus: "paid",
        userId: booking.userId,
        txnNumber: params.txnNumber,
      },
    },
    { upsert: true },
  );

  const admin = await User.find({ role: USER_ROLES.SUPER_ADMIN })
    .select("_id")
    .lean();

  const recipients = [booking.userId, booking.driverId]
    .map((value) => value?.toString())
    .filter((value): value is string => Boolean(value));

  await Promise.all([
    sendPushNotification({
      userIds: recipients,
      title: "Co-pay received",
      body: "Passenger co-pay is paid. The route can start.",
      data: { screen: "booking", referenceId: String(booking._id) },
    }),
    sendNotifications({
      text: "Trip completed",
      description: "The trip has been completed.",
      sender: admin?.[0]?._id,
      receiver: booking.userId,
      referenceId: String(booking._id),
      screen: "booking",
      type: "admin",
    }),
  ]);

  return booking;
};

export const chargeSavedCard = async (params: {
  bookingId: string;
  amount: number;
  customerId: string;
  paymentMethodId: string;
  userId: string;
}) => {
  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: Math.round(params.amount * 100),
        currency: "usd",
        customer: params.customerId,
        payment_method: params.paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: {
          bookingId: params.bookingId,
          charge: COPAY_CHARGE,
          userId: params.userId,
        },
      },
      { idempotencyKey: `copay-${params.bookingId}` },
    );

    if (intent.status !== "succeeded") return null;

    const booking = await finalizePassengerCopay({
      bookingId: params.bookingId,
      txnNumber: intent.id,
    });
    await saveUserPaymentMethod(
      params.userId,
      params.customerId,
      params.paymentMethodId,
    );
    return booking;
  } catch (error) {
    if (!(error instanceof Stripe.errors.StripeError)) throw error;
    if (error.code === "resource_missing") {
      await User.updateOne(
        { _id: params.userId },
        { $unset: { stripeDefaultPaymentMethodId: 1 } },
      );
    }
    return null;
  }
};

export const expireCheckoutSession = async (sessionId?: string) => {
  if (!sessionId) return;
  try {
    await stripe.checkout.sessions.expire(sessionId);
  } catch {
    // Session is already expired, completed, or missing.
  }
};

const copayMetadata = (bookingId: string, userId: string) => ({
  bookingId,
  charge: COPAY_CHARGE,
  userId,
});

export const createCopayCheckoutSession = async (params: {
  bookingId: string;
  amount: number;
  customerId: string;
  userId: string;
}) => {
  const metadata = copayMetadata(params.bookingId, params.userId);
  return stripe.checkout.sessions.create({
    mode: "payment",
    customer: params.customerId,
    client_reference_id: params.bookingId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(params.amount * 100),
          product_data: { name: `Trip co-pay ${params.bookingId}` },
        },
      },
    ],
    payment_intent_data: {
      setup_future_usage: "off_session",
      metadata,
    },
    saved_payment_method_options: {
      allow_redisplay_filters: ["always", "limited", "unspecified"],
    },
    metadata,
    success_url: `${config.stripe.paymentSuccess}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.stripe.paymentCancel}`,
  });
};
