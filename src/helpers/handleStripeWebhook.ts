import { Request, Response } from "express";
import Stripe from "stripe";
import colors from "colors";
import { logger } from "../shared/logger";
import config from "../config";
import stripe from "../config/stripe";
import { Booking } from "../app/modules/booking/booking.model";
import { Payment } from "../app/modules/payment/payment.model";

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
  }

  const eventType = event?.type;

  try {
    switch (eventType) {
      // checkout session success
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.bookingId;
        if (session.payment_status === "paid" && bookingId) {
          try {
            const booking = await Booking.findByIdAndUpdate(bookingId, {
              bookingStatus: "completed",
              paymentStatus: "paid",
            });
            if (booking) {
              await Payment.create({
                bookingId: booking._id,
                price: booking.price,
                paymentStatus: "paid",
                userId: booking.userId,
                txnNumber: session?.payment_intent as string,
              });
            }
          } catch (error) {
            logger.error(colors.bgRed.bold(`Error updating booking: ${error}`));
          }
        }
        break;
      }
      // checkout session failed
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.bookingId;
        if (bookingId) {
          await Booking.findByIdAndUpdate(bookingId, {
            paymentStatus: "failed",
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
