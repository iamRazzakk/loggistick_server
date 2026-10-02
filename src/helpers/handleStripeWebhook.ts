import { Request, Response } from "express";
import Stripe from "stripe";
import colors from "colors";
import {
  handleAccountUpdatedEvent,
  handleSubscriptionCreated,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from "../handlers";
import { StatusCodes } from "http-status-codes";
import { logger } from "../shared/logger";
import config from "../config";
import ApiError from "../errors/ApiErrors";
import stripe from "../config/stripe";
import { Booking } from "../app/modules/booking/booking.model";

const handleStripeWebhook = async (req: Request, res: Response) => {
  // Extract Stripe signature and webhook secret
  const signature = req.headers["stripe-signature"] as string;
  const webhookSecret = config.stripe.webhookSecret as string;

  let event: Stripe.Event | undefined;

  // Verify the event signature
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Webhook signature verification failed. ${error}`,
    );
  }

  // Check if the event is valid
  if (!event) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid event received!");
  }

  const eventType = event.type;

  try {
    switch (eventType) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.bookingId;
        if (session.payment_status === "paid" && bookingId) {
          await Booking.findByIdAndUpdate(bookingId, {
            bookingStatus: "completed",
          });
        }
        break;
      }

      default:
        logger.warn(colors.bgGreen.bold(`Unhandled event type: ${eventType}`));
    }
  } catch (error) {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Error handling event: ${error}`,
    );
  }

  res.sendStatus(200);
};

export default handleStripeWebhook;
