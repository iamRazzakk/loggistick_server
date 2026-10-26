import { Types } from "mongoose";
import {
  ChargeOutcome,
  MileageBracket,
  MileageRounding,
  MileageSource,
  PriceMethod,
  RateCard,
} from "../../booking/pricing/tripPricing";

export interface IMileageBasedPrice {
  starting_mileage: number;
  first_miles_price: number;
  per_mile_price: number;
}

export type IZonePricing = {
  inside?: RateCard;
  outside?: RateCard;
};

export type IMobilityBillingMap = {
  mobilityId: Types.ObjectId | string;
  billingClass: string;
};

export type IChargeRules = {
  cancellation?: ChargeOutcome;
  noShow?: ChargeOutcome;
};

// GeoJSON Polygon
interface IGeoJSONPolygon {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][]; // [ [ [lng, lat], ... ] ]
}

export interface ICounty {
  payersId: Types.ObjectId;
  coversAreasGeoJSON: IGeoJSONPolygon;

  priceMethod: PriceMethod;

  // flat_rate_price
  flat_rate_price?: number;

  // per_mile_price
  starting_fare?: number;
  first_miles_price?: number;
  per_mile_price?: number;
  base_rate?: number;
  per_mile_rate?: number;

  // mileage based price
  mileage_based_price?: IMileageBasedPrice[];
  mileage_brackets?: MileageBracket[];

  initial_miles?: number;
  initial_charge?: number;
  additional_per_mile?: number;

  /**
   * Deprecated zone fees. Pricing reads zonePricing and passenger copay
   * fields. These numbers are not used by the pricing engine.
   */
  insidePrice?: number;
  outsidePrice?: number;

  zonePricing?: IZonePricing;
  passengerCopayInside?: number;
  passengerCopayOutside?: number;
  mileageSource?: MileageSource;
  mileageRounding?: MileageRounding;
  mileagePrecision?: number;
  mobilityBillingMap?: IMobilityBillingMap[];
  chargeRules?: IChargeRules;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  isActive: boolean;
}
