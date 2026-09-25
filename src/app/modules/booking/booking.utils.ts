import { StatusCodes } from "http-status-codes";
import { Types } from "mongoose";
import ApiError from "../../../errors/ApiErrors";
import { ICounty } from "../serviceAndTariff/counties/counties.interface";
import { County } from "../serviceAndTariff/counties/counties.model";
import { Mobility } from "../serviceAndTariff/mobility/mobility.model";

type LngLat = [number, number]; // [longitude, latitude]

const EARTH_RADIUS_MILES = 3958.8;

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

const findCountyForPoint = (point: LngLat, payerId?: string) => {
  const filter: Record<string, unknown> = {
    isActive: true,
    coversAreasGeoJSON: {
      $geoIntersects: {
        $geometry: { type: "Point", coordinates: point },
      },
    },
  };

  if (payerId) {
    filter.payersId = new Types.ObjectId(payerId);
  }

  return County.findOne(filter).lean();
};

const sameCounty = (
  a?: { _id?: Types.ObjectId } | null,
  b?: { _id?: Types.ObjectId } | null,
) => Boolean(a?._id && b?._id && String(a._id) === String(b._id));

const priceByMethod = (county: ICounty, miles: number) => {
  if (county.priceMethod === "flat_rate") {
    return county.flat_rate_price ?? 0;
  }

  if (county.priceMethod === "per_mile") {
    const startingFare = county.starting_fare ?? 0;
    const firstMilesPrice = county.first_miles_price ?? 0;
    const perMile = county.per_mile_price ?? 0;
    if (miles <= 0) return startingFare;
    const extraMiles = Math.max(0, miles - 1);
    return startingFare + firstMilesPrice + extraMiles * perMile;
  }

  const band = county.mileage_based_price;
  if (!band) return 0;
  const extraMiles = Math.max(0, miles - band.starting_mileage);
  return band.first_miles_price + extraMiles * band.per_mile_price;
};

export const getTripPrice = async (input: {
  pickup: LngLat;
  dropoff: LngLat;
  stop?: LngLat;
  payerId?: string;
  tripType: "one-way" | "round-trip";
  mobilityRequirements?: string;
}) => {
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

  const pickupCounty = await findCountyForPoint(input.pickup, input.payerId);
  if (!pickupCounty) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Pickup is outside every active county for this payer.",
    );
  }

  const dropoffCounty = await findCountyForPoint(input.dropoff, input.payerId);
  const stopCounty = input.stop
    ? await findCountyForPoint(input.stop, input.payerId)
    : pickupCounty;

  const fullyInside =
    sameCounty(pickupCounty, dropoffCounty) &&
    (!input.stop || sameCounty(pickupCounty, stopCounty));

  const zoneFee = fullyInside
    ? (pickupCounty.insidePrice ?? 0)
    : (pickupCounty.outsidePrice ?? 0);

  const miles = tripMiles(input.pickup, input.dropoff, input.stop);
  const base = priceByMethod(pickupCounty, miles);

  let mobilityPrice = 0;
  if (input.mobilityRequirements) {
    const mobility = await Mobility.findById(input.mobilityRequirements)
      .select("price")
      .lean();
    mobilityPrice = mobility?.price ?? 0;
  }

  let total = base + zoneFee + mobilityPrice;
  if (input.tripType === "round-trip") {
    total *= 2;
  }

  return {
    totalPrice: Number(total.toFixed(2)),
    milesPrice: Number(miles.toFixed(2)),
    mobilityTotalPrice: Number(mobilityPrice.toFixed(2)),
    priceMethod: pickupCounty.priceMethod,
    countyId: pickupCounty._id,
    zone: fullyInside ? "inside" : "outside",
  };
};
