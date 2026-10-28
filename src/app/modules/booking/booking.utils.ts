import { format } from "date-fns";
import { StatusCodes } from "http-status-codes";
import { Types } from "mongoose";
import ApiError from "../../../errors/ApiErrors";
import { USER_ROLES } from "../../../enums/user";
import { ICounty } from "../serviceAndTariff/counties/counties.interface";
import { County } from "../serviceAndTariff/counties/counties.model";
import { Booking } from "./booking.model";
import { User } from "../user/user.model";
import stripe from "../../../config/stripe";
import config from "../../../config";
import { IBooking } from "./booking.interface";
import {
  ChargeOutcome,
  MileageSource,
  PricedLeg,
  RateCard,
  ZoneName,
  applyChargeOutcome,
  classifyZone,
  isCountyEffective,
  legacyBandsToBrackets,
  priceFundingSourceCharge,
  selectBillingMileage,
  toMoney,
} from "./pricing/tripPricing";

type LngLat = [number, number];

const EARTH_RADIUS_MILES = 3958.8;

export type TripQuote = {
  totalPrice: number;
  passengerCoPay: number;
  organizationContribution: number;
  fundingSourceCharge: number;
  milesPrice: number;
  mobilityTotalPrice: number;
  zoneCoPay: number;
  priceMethod?: ICounty["priceMethod"];
  countyId?: Types.ObjectId;
  zone: ZoneName;
  legs: PricedLeg[];
  calculatedRouteMileage: number | null;
  actualGpsMileage: number | null;
  straightLineMileage: number;
  billingMileage: number;
  billingMileageSource: string;
  cancellationOutcome: ChargeOutcome;
  noShowOutcome: ChargeOutcome;
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

const straightLineMiles = (points: LngLat[]) => {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += milesBetween(points[i - 1], points[i]);
  }
  return total;
};

const drivingMiles = async (from: LngLat, to: LngLat) => {
  const key = config.googleMapApi?.apiKey;
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const origin = `${from[1]},${from[0]}`;
    const destination = `${to[1]},${to[0]}`;
    const url =
      "https://maps.googleapis.com/maps/api/distancematrix/json" +
      `?origins=${encodeURIComponent(origin)}` +
      `&destinations=${encodeURIComponent(destination)}` +
      `&units=imperial&key=${encodeURIComponent(key)}`;
    const response = await fetch(url, { signal: controller.signal });
    const body = (await response.json()) as {
      rows?: {
        elements?: { status?: string; distance?: { value?: number } }[];
      }[];
    };
    const element = body.rows?.[0]?.elements?.[0];
    if (
      element?.status !== "OK" ||
      typeof element.distance?.value !== "number"
    ) {
      return null;
    }
    return element.distance.value / 1609.344;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

const measurePath = async (points: LngLat[], wantRoute: boolean) => {
  const straightLineMileage = straightLineMiles(points);
  if (!wantRoute) {
    return {
      straightLineMileage,
      calculatedRouteMileage: null as number | null,
    };
  }
  let route = 0;
  for (let i = 1; i < points.length; i += 1) {
    const driven = await drivingMiles(points[i - 1], points[i]);
    if (driven == null) {
      return { straightLineMileage, calculatedRouteMileage: null };
    }
    route += driven;
  }
  return { straightLineMileage, calculatedRouteMileage: route };
};

type PricingCounty = { _id: Types.ObjectId } & ICounty;

const serviceDayOf = (serviceDate?: string) => {
  if (serviceDate && /^\d{4}-\d{2}-\d{2}$/.test(serviceDate))
    return serviceDate;
  return new Date().toISOString().slice(0, 10);
};

const effectiveFilter = (serviceDay: string) => ({
  $and: [
    {
      $or: [
        { effectiveFrom: { $exists: false } },
        { effectiveFrom: null },
        { effectiveFrom: "" },
        { effectiveFrom: { $lte: serviceDay } },
      ],
    },
    {
      $or: [
        { effectiveTo: { $exists: false } },
        { effectiveTo: null },
        { effectiveTo: "" },
        { effectiveTo: { $gte: serviceDay } },
      ],
    },
  ],
});

const findCountyForPoint = (
  point: LngLat,
  payerId: string | undefined,
  serviceDay: string,
) => {
  const filter: Record<string, unknown> = {
    isActive: true,
    ...effectiveFilter(serviceDay),
    coversAreasGeoJSON: {
      $geoIntersects: {
        $geometry: { type: "Point", coordinates: point },
      },
    },
  };
  if (payerId && Types.ObjectId.isValid(payerId)) {
    filter.payersId = new Types.ObjectId(payerId);
  }
  return County.findOne(filter)
    .sort({ effectiveFrom: -1 })
    .lean<PricingCounty>();
};

const loadActiveCounty = (countyId: string) =>
  County.findOne({
    _id: new Types.ObjectId(countyId),
    isActive: true,
  }).lean<PricingCounty>();

/**
 * countyId, when sent, selects the tariff.
 * Otherwise the rider id is used to read User.county.
 * Geo lookup stays only when neither id resolves a county.
 */
const resolvePickupCounty = async (input: {
  pickup: LngLat;
  payerId?: string;
  countyId?: string;
  userId?: string;
  serviceDate?: string;
}) => {
  const serviceDay = serviceDayOf(input.serviceDate);
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
    if (!isCountyEffective(county, serviceDay)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Pricing county is not effective on this service date.",
      );
    }
    return county;
  }

  return findCountyForPoint(input.pickup, input.payerId, serviceDay);
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

const billingClassFor = (county: PricingCounty, mobilityId?: string) => {
  if (!mobilityId || !county.mobilityBillingMap?.length) return undefined;
  const row = county.mobilityBillingMap.find(
    (item) => String(item.mobilityId) === String(mobilityId),
  );
  return row?.billingClass;
};

const rateCardFor = (
  county: PricingCounty,
  zone: ZoneName,
  billingClass?: string,
): RateCard => {
  const zoneCard = county.zonePricing?.[zone];
  const classCard = billingClass
    ? zoneCard?.classRates?.find((row) => row.billingClass === billingClass)
    : undefined;
  const selected = classCard ?? zoneCard;
  const legacyBrackets = county.mileage_brackets?.length
    ? county.mileage_brackets
    : legacyBandsToBrackets(county.mileage_based_price);
  const zoneCopay =
    zone === "inside"
      ? (county.passengerCopayInside ?? 0)
      : (county.passengerCopayOutside ?? 0);

  if (!selected) {
    return {
      priceMethod: county.priceMethod,
      flat_rate_price: county.flat_rate_price,
      base_rate: county.base_rate ?? county.starting_fare ?? 0,
      per_mile_rate: county.per_mile_rate ?? county.per_mile_price ?? 0,
      mileage_brackets: legacyBrackets,
      initial_miles: county.initial_miles ?? 0,
      initial_charge: county.initial_charge ?? 0,
      additional_per_mile: county.additional_per_mile ?? 0,
      passenger_copay: zoneCopay,
    };
  }

  return {
    priceMethod: selected.priceMethod,
    flat_rate_price: selected.flat_rate_price ?? county.flat_rate_price,
    base_rate:
      selected.base_rate ?? county.base_rate ?? county.starting_fare ?? 0,
    per_mile_rate:
      selected.per_mile_rate ??
      county.per_mile_rate ??
      county.per_mile_price ??
      0,
    mileage_brackets: selected.mileage_brackets?.length
      ? selected.mileage_brackets
      : legacyBrackets,
    initial_miles: selected.initial_miles ?? county.initial_miles ?? 0,
    initial_charge: selected.initial_charge ?? county.initial_charge ?? 0,
    additional_per_mile:
      selected.additional_per_mile ?? county.additional_per_mile ?? 0,
    passenger_copay: selected.passenger_copay ?? zoneCopay,
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
  serviceDate?: string;
  actualGpsMileage?: number | null;
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
  if (!pickupCounty) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "No active pricing county covers this trip.",
    );
  }

  const pickupInside = Boolean(
    await countyCoversPoint(pickupCounty._id, input.pickup),
  );
  const dropoffInside = Boolean(
    await countyCoversPoint(pickupCounty._id, input.dropoff),
  );
  const outboundZone = classifyZone(pickupInside, dropoffInside);
  const returnZone = classifyZone(dropoffInside, pickupInside);
  const billingClass = billingClassFor(
    pickupCounty,
    input.mobilityRequirements,
  );
  const mileageSource: MileageSource =
    pickupCounty.mileageSource ?? "straight_line";
  const rounding = pickupCounty.mileageRounding ?? "none";
  const precision = pickupCounty.mileagePrecision ?? 2;
  const wantRoute = mileageSource === "calculated_route";
  const gps =
    input.actualGpsMileage != null && Number.isFinite(input.actualGpsMileage)
      ? input.actualGpsMileage
      : null;

  const paths: {
    leg: PricedLeg["leg"];
    zone: ZoneName;
    points: LngLat[];
    gps: number | null;
  }[] = [
    {
      leg: "outbound",
      zone: outboundZone,
      points: input.stop
        ? [input.pickup, input.stop, input.dropoff]
        : [input.pickup, input.dropoff],
      gps: input.tripType === "round-trip" ? null : gps,
    },
  ];
  if (input.tripType === "round-trip") {
    paths.push({
      leg: "return",
      zone: returnZone,
      points: [input.dropoff, input.pickup],
      gps: null,
    });
  }
  if (input.tripType === "one-way") {
    paths[0].gps = gps;
  } else if (gps != null) {
    paths[0].gps = gps;
  }

  const legs: PricedLeg[] = [];
  for (const path of paths) {
    const measured = await measurePath(path.points, wantRoute);
    const selected = selectBillingMileage({
      source: mileageSource,
      calculatedRouteMileage: measured.calculatedRouteMileage,
      actualGpsMileage: path.gps,
      straightLineMileage: measured.straightLineMileage,
    });
    const card = rateCardFor(pickupCounty, path.zone, billingClass);
    const priced = priceFundingSourceCharge(
      card,
      selected.billingMileage,
      rounding,
      precision,
    );
    legs.push({
      leg: path.leg,
      zone: path.zone,
      billingClass,
      priceMethod: card.priceMethod,
      straightLineMileage: Number(measured.straightLineMileage.toFixed(4)),
      calculatedRouteMileage: measured.calculatedRouteMileage,
      billingMileage: priced.billingMileage,
      billingMileageSource: selected.billingMileageSource,
      fundingSourceCharge: priced.charge,
      passengerCoPay: toMoney(card.passenger_copay ?? 0),
    });
  }

  const fundingSourceCharge = toMoney(
    legs.reduce((sum, leg) => sum + leg.fundingSourceCharge, 0),
  );
  const passengerCoPay = toMoney(
    legs.reduce((sum, leg) => sum + leg.passengerCoPay, 0),
  );
  const straightLineMileage = legs.reduce(
    (sum, leg) => sum + leg.straightLineMileage,
    0,
  );
  const routeValues = legs.map((leg) => leg.calculatedRouteMileage);
  const calculatedRouteMileage = routeValues.every((value) => value != null)
    ? routeValues.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;

  return {
    totalPrice: fundingSourceCharge,
    passengerCoPay,
    organizationContribution: fundingSourceCharge,
    fundingSourceCharge,
    milesPrice: Number(
      legs.reduce((sum, leg) => sum + leg.billingMileage, 0).toFixed(2),
    ),
    mobilityTotalPrice: 0,
    zoneCoPay: passengerCoPay,
    priceMethod: legs[0]?.priceMethod,
    countyId: pickupCounty._id,
    zone: outboundZone,
    legs,
    calculatedRouteMileage,
    actualGpsMileage: gps,
    straightLineMileage: Number(straightLineMileage.toFixed(4)),
    billingMileage: Number(
      legs.reduce((sum, leg) => sum + leg.billingMileage, 0).toFixed(4),
    ),
    billingMileageSource: legs[0]?.billingMileageSource ?? mileageSource,
    cancellationOutcome: pickupCounty.chargeRules?.cancellation ?? "both",
    noShowOutcome: pickupCounty.chargeRules?.noShow ?? "both",
  };
};

const FARE_KEYS = [
  "totalPrice",
  "organizationContribution",
  "pricingLegs",
  "fundingSourceCharge",
] as const;

/** Passenger responses keep `price` (the co-pay) and drop the funding-source fare. */
export const presentBookingForViewer = <T>(booking: T, role?: string): T => {
  if (role !== USER_ROLES.USER || !booking || Array.isArray(booking)) {
    return booking;
  }
  const source = booking as Record<string, unknown>;
  const copy: Record<string, unknown> = { ...source };
  for (const key of FARE_KEYS) delete copy[key];
  if (copy.passengerCoPay != null) copy.price = copy.passengerCoPay;
  return copy as T;
};

export const presentBookingsForViewer = <T>(data: T, role?: string): T => {
  if (role !== USER_ROLES.USER || data == null) return data;
  if (Array.isArray(data)) {
    return data.map((item) => presentBookingForViewer(item, role)) as T;
  }
  return presentBookingForViewer(data, role);
};

export const presentQuoteForViewer = (quote: TripQuote, role?: string) => {
  if (role !== USER_ROLES.USER) return quote;
  return {
    passengerCoPay: quote.passengerCoPay,
    price: quote.passengerCoPay,
    zone: quote.zone,
  };
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
 * Charge only the passenger co-pay. Reuse an open Checkout session.
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

export const userDisplayName = (
  user?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
  } | null,
) =>
  [user?.firstName, user?.middleName, user?.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ") || "A rider";

const formatBookingDate = (value?: string) => {
  if (!value) return "";
  const isoDate = value.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (match) {
    return format(
      new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
      "MMM d, yyyy",
    );
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "MMM d, yyyy");
};

export const pendingBookingNotificationCopy = (
  rider: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
  } | null,
  booking: Pick<
    IBooking,
    | "pickupTime"
    | "appointmentTime"
    | "serviceDate"
    | "endDate"
    | "recurringBooking"
  >,
) => {
  const name = userDisplayName(rider);
  const pickupTime = booking.pickupTime?.trim();
  const appointmentTime = booking.appointmentTime?.trim();
  const startDate = formatBookingDate(booking.serviceDate);
  const endDate = formatBookingDate(booking.endDate);

  return {
    text: `${name} booked a new trip`,
    description:
      booking.recurringBooking && endDate
        ? `${name} booked a trip at ${pickupTime} from ${startDate} to ${endDate}.`
        : `${name} booked a trip from ${pickupTime} to ${appointmentTime}.`,
  };
};

export const applyServerFare = (
  payload: Partial<IBooking>,
  quote: TripQuote,
) => {
  payload.totalPrice = quote.fundingSourceCharge;
  payload.passengerCoPay = quote.passengerCoPay;
  payload.organizationContribution = quote.fundingSourceCharge;
  payload.price = quote.passengerCoPay;
  payload.paymentStatus = quote.passengerCoPay <= 0 ? "paid" : "pending";
  payload.calculatedRouteMileage = quote.calculatedRouteMileage;
  payload.actualGpsMileage = quote.actualGpsMileage;
  payload.straightLineMileage = quote.straightLineMileage;
  payload.billingMileage = quote.billingMileage;
  payload.billingMileageSource = quote.billingMileageSource;
  payload.pricingLegs = quote.legs;
  payload.cancellationOutcome = quote.cancellationOutcome;
  payload.noShowOutcome = quote.noShowOutcome;
  payload.countyId = quote.countyId;
};

export const fareAfterChargeOutcome = (
  fundingSourceCharge: number,
  passengerCopay: number,
  outcome: ChargeOutcome,
) => {
  const applied = applyChargeOutcome(
    fundingSourceCharge,
    passengerCopay,
    outcome,
  );
  return {
    totalPrice: toMoney(applied.fundingSourceCharge),
    organizationContribution: toMoney(applied.fundingSourceCharge),
    passengerCoPay: toMoney(applied.passengerCopay),
    price: toMoney(applied.passengerCopay),
    paymentStatus: (applied.passengerCopay <= 0 ? "paid" : "pending") as
      | "paid"
      | "pending",
  };
};
