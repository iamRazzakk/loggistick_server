import { Request, Response } from "express";
import Stripe from "stripe";
import colors from "colors";
import { logger } from "../shared/logger";
import config from "../config";
import stripe from "../config/stripe";
import { Booking } from "../app/modules/booking/booking.model";
import { Payment } from "../app/modules/payment/payment.model";
import { sendPushNotification } from "./notificationsHelper";

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
      // checkout session success
      // case "checkout.session.completed": {
      //   const session = event.data.object as Stripe.Checkout.Session;
      //   const bookingId = session.metadata?.bookingId;

      //   if (session.payment_status === "paid" && bookingId) {
      //     try {
      //       const booking = await Booking.findByIdAndUpdate(bookingId, {
      //         bookingStatus: "completed",
      //         paymentStatus: "paid",
      //       });
      //       if (booking) {
      //         await Payment.create({
      //           bookingId: booking._id,
      //           price: booking.price,
      //           paymentStatus: "paid",
      //           userId: booking.userId,
      //           txnNumber: session?.payment_intent as string,
      //         });
      //       }
      //     } catch (error) {
      //       logger.error(colors.bgRed.bold(`Error updating booking: ${error}`));
      //     }
      //   }
      //   break;
      // }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.bookingId;
        /**
         * PREVIOUS IMPLEMENTATION
         * Set bookingStatus to "completed" and inserted a Payment row
         * with no duplicate guard. Payment finished the trip.
         *
         * NEW IMPLEMENTATION
         * Only a paid Checkout marks paymentStatus "paid".
         * Trip status stays onboard until the driver starts the route.
         * findOneAndUpdate is the lock, so a repeated webhook does not
         * insert a second payment or send a second notification.
         */
        if (session.payment_status !== "paid" || !bookingId) break;
        const booking = await Booking.findOneAndUpdate(
          { _id: bookingId, paymentStatus: { $ne: "paid" } },
          {
            $set: {
              bookingStatus: "completed",
              paymentStatus: "paid",
            },
            $unset: { stripeCheckoutSessionId: 1 },
          },
          { new: true },
        );
        if (!booking) break;

        await Payment.updateOne(
          { bookingId: booking._id },
          {
            $setOnInsert: {
              bookingId: booking._id,
              price: booking.passengerCoPay ?? booking.price,
              paymentStatus: "paid",
              userId: booking.userId,
              txnNumber: String(session.payment_intent ?? session.id),
            },
          },
          { upsert: true },
        );
        const recipients = [booking.userId, booking.driverId]
          .map((value) => value?.toString())
          .filter((value): value is string => Boolean(value));

        await sendPushNotification({
          userIds: recipients,
          title: "Co-pay received",
          body: "Passenger co-pay is paid. The route can start.",
          data: { screen: "booking", referenceId: String(booking._id) },
        });
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
