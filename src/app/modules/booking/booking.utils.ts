import { StatusCodes } from "http-status-codes";
import { Types } from "mongoose";
import ApiError from "../../../errors/ApiErrors";
import { USER_ROLES } from "../../../enums/user";
import {
  ICounty,
  IMileageBasedPrice,
} from "../serviceAndTariff/counties/counties.interface";
import { County } from "../serviceAndTariff/counties/counties.model";
import { Mobility } from "../serviceAndTariff/mobility/mobility.model";
import { Booking } from "./booking.model";
import { User } from "../user/user.model";
import stripe from "../../../config/stripe";
import config from "../../../config";
import { IBooking } from "./booking.interface";

type LngLat = [number, number];

const EARTH_RADIUS_MILES = 3958.8;

export type TripQuote = {
  totalPrice: number;
  passengerCoPay: number;
  organizationContribution: number;
  milesPrice: number;
  mobilityTotalPrice: number;
  zoneCoPay: number;
  priceMethod?: ICounty["priceMethod"];
  countyId?: Types.ObjectId;
  zone: "inside" | "outside";
};

const isLngLat = (value: LngLat) =>
  Array.isArray(value) &&
  value.length === 2 &&
  Number.isFinite(value[0]) &&
  Number.isFinite(value[1]);

const milesBetween = (from: LngLat, to: LngLat) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to[1] - from[1]);
  const dLng = toRad(to[0] - from[0]);
  const lat1 = toRad(from[1]);
  const lat2 = toRad(to[1]);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MILES * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const tripMiles = (pickup: LngLat, dropoff: LngLat, stop?: LngLat) => {
  if (!stop) return milesBetween(pickup, dropoff);
  return milesBetween(pickup, stop) + milesBetween(stop, dropoff);
};

const toMoney = (value: number) => {
  if (!Number.isFinite(value)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Trip price could not be calculated",
    );
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

type PricingCounty = { _id: Types.ObjectId } & ICounty;

const findCountyForPoint = (point: LngLat, payerId?: string) => {
  const filter: Record<string, unknown> = {
    isActive: true,
    coversAreasGeoJSON: {
      $geoIntersects: {
        $geometry: { type: "Point", coordinates: point },
      },
    },
  };
  if (payerId && Types.ObjectId.isValid(payerId)) {
    filter.payersId = new Types.ObjectId(payerId);
  }
  return County.findOne(filter).lean<PricingCounty>();
};

const loadActiveCounty = (countyId: string) =>
  County.findOne({
    _id: new Types.ObjectId(countyId),
    isActive: true,
  }).lean<PricingCounty>();

/**
 * countyId, when sent, selects the tariff.
 * Otherwise the authenticated user id (JWT) is used to read User.county.
 * The body is never trusted for that user id.
 * Geo lookup stays only when neither id resolves a county.
 */
const resolvePickupCounty = async (input: {
  pickup: LngLat;
  payerId?: string;
  countyId?: string;
  userId?: string;
}) => {
  let countyId = input.countyId;
  if (
    (!countyId || !Types.ObjectId.isValid(countyId)) &&
    input.userId &&
    Types.ObjectId.isValid(input.userId)
  ) {
    const rider = await User.findById(input.userId).select("county").lean();
    if (rider?.county) countyId = String(rider.county);
  }

  if (countyId && Types.ObjectId.isValid(countyId)) {
    const county = await loadActiveCounty(countyId);
    if (!county) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Active county not found for this rider.",
      );
    }
    return county;
  }

  return findCountyForPoint(input.pickup, input.payerId);
};

const countyCoversPoint = (countyId: Types.ObjectId, point: LngLat) =>
  County.exists({
    _id: countyId,
    isActive: true,
    coversAreasGeoJSON: {
      $geoIntersects: {
        $geometry: { type: "Point", coordinates: point },
      },
    },
  });

const mileageBands = (
  value: ICounty["mileage_based_price"],
): IMileageBasedPrice[] => {
  if (!value) return [];
  const rows = Array.isArray(value) ? value : [value as IMileageBasedPrice];
  return rows.filter(
    (band) =>
      Number.isFinite(band?.starting_mileage) &&
      Number.isFinite(band?.first_miles_price) &&
      Number.isFinite(band?.per_mile_price),
  );
};

/**
 * Tier matching implementation for mileage_based price method:
 * 1) Bands are sorted ascending by starting_mileage (e.g. 20, 25, 30, 35).
 * 2) Match the tier where miles fall into (e.g. miles <= 20 uses Band 1; 20-25 uses Band 2, etc.)
 *    and charge that tier's first_miles_price.
 * 3) If miles exceed all defined tiers (e.g. miles > 35), use the highest tier's
 *    first_miles_price plus extra miles charged at that tier's per_mile_price.
 */
const priceMileageBand = (county: ICounty, miles: number) => {
  const bands = mileageBands(county.mileage_based_price).sort(
    (a, b) => a.starting_mileage - b.starting_mileage,
  );
  if (!bands.length) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Mileage bands are missing for the pickup county",
    );
  }

  // 1) Match the tier where miles fall into
  for (const band of bands) {
    if (miles <= band.starting_mileage) {
      return band.first_miles_price;
    }
  }

  // 2) If miles exceed all defined tiers, charge extra miles at highest tier's per_mile_price
  const highestBand = bands[bands.length - 1];
  const extraMiles = Math.max(0, miles - highestBand.starting_mileage);
  return (
    highestBand.first_miles_price + extraMiles * highestBand.per_mile_price
  );
};

const priceByMethod = (county: ICounty, miles: number) => {
  if (county.priceMethod === "flat_rate") {
    if (county.flat_rate_price == null) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Flat rate is missing for the pickup county",
      );
    }
    return county.flat_rate_price;
  }

  if (county.priceMethod === "per_mile") {
    const startingFare = county.starting_fare ?? 0;
    const firstMilesPrice = county.first_miles_price ?? 0;
    const perMile = county.per_mile_price ?? 0;
    if (miles <= 0) return startingFare;
    return startingFare + firstMilesPrice + Math.max(0, miles - 1) * perMile;
  }

  return priceMileageBand(county, miles);
};

/**
 * PREVIOUS IMPLEMENTATION
 * zone fee was added into one `price` (base + inside/outside + mobility).
 * Passenger and Stripe both saw that total.
 *
 * NEW IMPLEMENTATION
 * totalPrice = method fare + mobility (doubled for round trip).
 * passengerCoPay = insidePrice or outsidePrice (doubled for round trip).
 * organizationContribution = totalPrice - passengerCoPay.
 * Change only this function if the meeting rule is different.
 */
const splitTripFare = (input: {
  methodFare: number;
  mobilityPrice: number;
  fullyInside: boolean;
  county: ICounty;
  tripType: "one-way" | "round-trip";
}): Pick<
  TripQuote,
  "totalPrice" | "passengerCoPay" | "organizationContribution" | "zoneCoPay"
> => {
  const multiplier = input.tripType === "round-trip" ? 2 : 1;
  const totalPrice = toMoney(
    (input.methodFare + input.mobilityPrice) * multiplier,
  );
  const zoneCoPay = input.fullyInside
    ? (input.county.insidePrice ?? 0)
    : (input.county.outsidePrice ?? 0);
  const rawCoPay = toMoney(zoneCoPay * multiplier);
  const passengerCoPay = Math.min(rawCoPay, totalPrice);
  return {
    totalPrice,
    passengerCoPay,
    organizationContribution: toMoney(totalPrice - passengerCoPay),
    zoneCoPay: passengerCoPay,
  };
};

export const getTripPrice = async (input: {
  pickup: LngLat;
  dropoff: LngLat;
  stop?: LngLat;
  payerId?: string;
  countyId?: string;
  userId?: string;
  tripType: "one-way" | "round-trip";
  mobilityRequirements?: string;
}): Promise<TripQuote> => {
  if (!isLngLat(input.pickup) || !isLngLat(input.dropoff)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Pickup and dropoff must be [longitude, latitude].",
    );
  }
  if (input.stop && !isLngLat(input.stop)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Stop must be [longitude, latitude].",
    );
  }

  const pickupCounty = await resolvePickupCounty(input);
  /**
   * PREVIOUS IMPLEMENTATION
   * Missing county was ignored and the fare became 0.
   */
  if (!pickupCounty) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Pickup is outside every active county for this payer.",
    );
  }

  const dropoffInside = await countyCoversPoint(
    pickupCounty._id,
    input.dropoff,
  );
  const stopInside = input.stop
    ? await countyCoversPoint(pickupCounty._id, input.stop)
    : true;
  const fullyInside = Boolean(dropoffInside) && Boolean(stopInside);

  const miles = tripMiles(input.pickup, input.dropoff, input.stop);
  const methodFare = priceByMethod(pickupCounty, miles);

  let mobilityPrice = 0;
  if (
    input.mobilityRequirements &&
    Types.ObjectId.isValid(input.mobilityRequirements)
  ) {
    const mobility = await Mobility.findById(input.mobilityRequirements)
      .select("price")
      .lean();
    mobilityPrice = mobility?.price ?? 0;
  }

  const split = splitTripFare({
    methodFare,
    mobilityPrice,
    fullyInside,
    county: pickupCounty,
    tripType: input.tripType,
  });

  return {
    ...split,
    milesPrice: Number(miles.toFixed(2)),
    mobilityTotalPrice: toMoney(mobilityPrice),
    priceMethod: pickupCounty.priceMethod,
    countyId: pickupCounty._id,
    zone: fullyInside ? "inside" : "outside",
  };
};

const FARE_KEYS = ["totalPrice", "organizationContribution"] as const;

/** Passenger responses keep `price` (the co-pay) and drop the organization fare. */
export const presentBookingForViewer = <T>(booking: T, role?: string): T => {
  if (role !== USER_ROLES.USER || !booking || Array.isArray(booking))
    return booking;
  const source = booking as Record<string, unknown>;
  const copy: Record<string, unknown> = { ...source };
  for (const key of FARE_KEYS) delete copy[key];
  if (copy.passengerCoPay != null) copy.price = copy.passengerCoPay;
  return copy as T;
};

export const toBookingErrorMessage = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (message.toLowerCase().includes("timed out")) {
    return "Recurring booking creation is taking too long. Please try a shorter date range.";
  }
  return message || "Failed to create recurring bookings. Please try again.";
};

const coPayAmount = (booking: { passengerCoPay?: number; price?: number }) =>
  booking.passengerCoPay ?? booking.price ?? 0;

/**
 * PREVIOUS IMPLEMENTATION
 * Charged `price` (the full fare), incremented the rider trip count,
 * and wrote the booking before Stripe confirmed anything.
 * Calling this from status "completed" also finished the trip on payment.
 *
 * NEW IMPLEMENTATION
 * Charge only the co-pay. Reuse an open Checkout session.
 * Do not change trip status and do not mark the payment paid here.
 */
export const handlePayment = async (id: string) => {
  const existing = await Booking.findById(id).select(
    "price passengerCoPay userId bookingStatus paymentStatus stripeCheckoutSessionId",
  );
  if (!existing) throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  if (existing.bookingStatus !== "trip-completed") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Co-pay can be collected only after the passenger is completed the trip",
    );
  }
  if (existing.paymentStatus === "paid") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Passenger co-pay is already paid",
    );
  }

  const amount = coPayAmount(existing);
  if (amount <= 0) {
    existing.paymentStatus = "paid";
    await existing.save();
    return { booking: existing.toObject(), checkoutUrl: null as string | null };
  }

  if (existing.stripeCheckoutSessionId) {
    try {
      const open = await stripe.checkout.sessions.retrieve(
        existing.stripeCheckoutSessionId,
      );
      if (open.status === "open" && open.url) {
        return { booking: existing.toObject(), checkoutUrl: open.url };
      }
    } catch {
      // The old session cannot be reused. A new one is created below.
    }
  }

  const rider = await User.findById(existing.userId).lean().select("email");
  if (!rider?.email)
    throw new ApiError(StatusCodes.NOT_FOUND, "Rider email not found");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: rider.email,
    client_reference_id: id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(amount * 100),
          product_data: { name: `Trip co-pay ${id}` },
        },
      },
    ],
    metadata: { bookingId: id, charge: "passenger-copay" },
    success_url: `${config.stripe.paymentSuccess}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.stripe.paymentCancel}`,
  });

  existing.stripeCheckoutSessionId = session.id;
  existing.paymentStatus = "pending";
  await existing.save();

  return { booking: existing.toObject(), checkoutUrl: session.url };
};

export const applyServerFare = (
  payload: Partial<IBooking>,
  quote: TripQuote,
) => {
  payload.totalPrice = quote.totalPrice;
  payload.passengerCoPay = quote.passengerCoPay;
  payload.organizationContribution = quote.organizationContribution;
  payload.price = quote.passengerCoPay;
  payload.paymentStatus = quote.passengerCoPay <= 0 ? "paid" : "pending";
};
