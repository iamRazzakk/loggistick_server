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
  mobilityId?: Types.ObjectId | string;
  spaceType?: string;
  billingClass: string;
  status?: "enabled" | "disabled";
};

export type IChargeRules = {
  cancellation?: ChargeOutcome;
  noShow?: ChargeOutcome;
};

/** GeoJSON Polygon or MultiPolygon (WGS84 lon/lat). */
export interface IGeoJSONPolygon {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}

export type IGeofence = {
  name: string;
  geometry: IGeoJSONPolygon;
  isActive?: boolean;
};

export type TripReasonPermission = "allowed" | "blocked";

export type ITripReasonRule = {
  name: string;
  inside: TripReasonPermission;
  outside: TripReasonPermission;
  maxMiles?: number | null;
};

export type PricingArea = "inside" | "outside" | "both";

export type ContractPricingMethod =
  | "flat_rate"
  | "base_plus_additional_mileage"
  | "mileage_brackets"
  | PriceMethod;

export type IPricingRule = {
  ruleName: string;
  billingClass: string;
  area: PricingArea;
  method: ContractPricingMethod;
  flatRate?: number;
  includedMiles?: number;
  baseRate?: number;
  additionalMileRate?: number;
  brackets?: Array<{ from: number; to?: number | null; amount: number }>;
};

export type ICountyEligibility = {
  authorizationIdRequired?: boolean;
  monthlyTripLimit?: number;
  allowAdminOverride?: boolean;
  eligibilityNotes?: string;
};

export type ICountyProgramRules = {
  extraStopsAllowed?: boolean;
  companionsAllowed?: boolean;
  maximumCompanions?: number;
  companionCharge?: number;
  tripReasons?: ITripReasonRule[];
};

export type ICancellationNoShowCharges = {
  freeCancellationWindowHours?: number;
  lateCancellationPassenger?: number;
  lateCancellationFundingSource?: number;
  noShowPassenger?: number;
  noShowFundingSource?: number;
};

export type ICountyReporting = {
  templateName?: string;
  columns?: string[];
  complaintResponseDeadlineHours?: number;
  safetyIncidentReportingDeadlineHours?: number;
};

export interface ICounty {
  payersId: Types.ObjectId;
  fundingSourceId?: Types.ObjectId | null;

  /** Contract general (Funding Source Contract identity on this tariff). */
  name?: string;
  organizationType?: "county" | "government" | "private" | "other" | string;
  programName?: string;
  description?: string;

  /**
   * Named service-area fences (source of truth).
   * Upload JSON FeatureCollection → one row per feature.
   */
  geofences?: IGeofence[];

  /**
   * Denormalized union of active geofences for legacy geo queries.
   * Kept in sync on create/update when geofences are present.
   */
  coversAreasGeoJSON?: IGeoJSONPolygon;

  priceMethod: PriceMethod;

  flat_rate_price?: number;
  starting_fare?: number;
  first_miles_price?: number;
  per_mile_price?: number;
  base_rate?: number;
  per_mile_rate?: number;
  mileage_based_price?: IMileageBasedPrice[];
  mileage_brackets?: MileageBracket[];
  initial_miles?: number;
  initial_charge?: number;
  additional_per_mile?: number;

  /** @deprecated Prefer zonePricing / passengerCopay* */
  insidePrice?: number;
  outsidePrice?: number;

  zonePricing?: IZonePricing;
  /** Named pricing rules from Funding Source Contract setup (also synced into zonePricing). */
  pricingRules?: IPricingRule[];

  passengerCopayInside?: number;
  passengerCopayOutside?: number;
  authorizeCopayAtBooking?: boolean;
  captureCopayAfterCompletedTrip?: boolean;

  mileageSource?: MileageSource;
  mileageRounding?: MileageRounding;
  mileagePrecision?: number;
  mobilityBillingMap?: IMobilityBillingMap[];
  chargeRules?: IChargeRules;
  cancellationNoShow?: ICancellationNoShowCharges;

  eligibility?: ICountyEligibility;
  programRules?: ICountyProgramRules;
  reporting?: ICountyReporting;

  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  isActive: boolean;
}
