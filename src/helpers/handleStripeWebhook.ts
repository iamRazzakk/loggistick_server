import { Request, Response } from "express";
import Stripe from "stripe";
import colors from "colors";
import { logger } from "../shared/logger";
import config from "../config";
import stripe from "../config/stripe";
import { Booking } from "../app/modules/booking/booking.model";
import {
  COPAY_CHARGE,
  finalizePassengerCopay,
  saveUserPaymentMethod,
  stripeId,
} from "./stripeCopay";

const persistCardFromIntent = async (
  userId: string | undefined,
  customer: unknown,
  paymentMethod: unknown,
) => {
  if (!userId) return;
  await saveUserPaymentMethod(
    userId,
    stripeId(customer),
    stripeId(paymentMethod),
  );
};

const handleStripeWebhook = async (req: Request, res: Response) => {
  // Extract Stripe signature and webhook secret
  const signature = req.headers["stripe-signature"] as string;
  const webhookSecret = config.stripe.webhookSecret as string;

  let event: Stripe.Event | undefined;

  // Verify the event signature
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    logger.error(
      colors.bgRed.bold(`Webhook signature verification failed. ${error}`),
    );
  }

  // Check if the event is valid
  if (!event) {
    logger.error(colors.bgRed.bold("Invalid event received!"));
    res.sendStatus(400);
    return;
  }

  const eventType = event?.type;

  try {
    switch (eventType) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.bookingId;
        /**
         * Only a paid Checkout marks paymentStatus "paid".
         * Trip status stays onboard until the driver starts the route.
         * findOneAndUpdate is the lock, so a repeated webhook does not
         * insert a second payment or send a second notification.
         */

        if (session.payment_status !== "paid" || !bookingId) break;

        const paymentIntentId = stripeId(session.payment_intent);
        let paymentMethodId: string | undefined;
        if (paymentIntentId) {
          const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
          paymentMethodId = stripeId(intent.payment_method);
        }

        const booking = await finalizePassengerCopay({
          bookingId,
          txnNumber: String(session.payment_intent ?? session.id),
        });

        await persistCardFromIntent(
          booking?.userId?.toString() ?? session.metadata?.userId,
          session.customer,
          paymentMethodId,
        );

        break;
      }
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        if (intent.metadata?.charge !== COPAY_CHARGE) break;
        const bookingId = intent.metadata.bookingId;
        if (!bookingId) break;

        const booking = await finalizePassengerCopay({
          bookingId,
          txnNumber: intent.id,
        });

        await persistCardFromIntent(
          booking?.userId?.toString() ?? intent.metadata.userId,
          intent.customer,
          intent.payment_method,
        );
        break;
      }
      // checkout session failed
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.bookingId;
        if (bookingId) {
          await Booking.findByIdAndUpdate(bookingId, {
            paymentStatus: "failed",
            $unset: { stripeCheckoutSessionId: 1 },
          });
        }
        break;
      }

      default:
        logger.warn(colors.bgGreen.bold(`Unhandled event type: ${eventType}`));
    }
  } catch (error) {
    logger.error(colors.bgRed.bold(`Error handling event: ${error}`));
  }

  res.sendStatus(200);
};

export default handleStripeWebhook;
