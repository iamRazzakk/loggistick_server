import { model, Schema } from "mongoose";
import { ICounty } from "./counties.interface";

const mileageBasedPriceSchema = new Schema(
  {
    starting_mileage: { type: Number, required: true },
    first_miles_price: { type: Number, required: true },
    per_mile_price: { type: Number, required: true },
  },
  { _id: false },
);

const mileageBracketSchema = new Schema(
  {
    min_mileage: { type: Number, required: true },
    max_mileage: { type: Number, required: false },
    charge: { type: Number, required: true },
  },
  { _id: false },
);

const mobilityBillingMapSchema = new Schema(
  {
    mobilityId: { type: Schema.Types.ObjectId, ref: "Mobility" },
    spaceType: { type: String },
    billingClass: { type: String, required: true },
    status: {
      type: String,
      enum: ["enabled", "disabled"],
      default: "enabled",
    },
  },
  { _id: false },
);

const geometrySchema = new Schema(
  {
    type: {
      type: String,
      enum: ["Polygon", "MultiPolygon"],
      required: true,
    },
    coordinates: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { _id: false },
);

const geofenceSchema = new Schema(
  {
    name: { type: String, required: true },
    geometry: { type: geometrySchema, required: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);

const tripReasonSchema = new Schema(
  {
    name: { type: String, required: true },
    inside: { type: String, enum: ["allowed", "blocked"], default: "allowed" },
    outside: {
      type: String,
      enum: ["allowed", "blocked"],
      default: "allowed",
    },
    maxMiles: { type: Number },
  },
  { _id: false },
);

const pricingRuleBracketSchema = new Schema(
  {
    from: { type: Number, required: true },
    to: { type: Number },
    amount: { type: Number, required: true },
  },
  { _id: false },
);

const pricingRuleSchema = new Schema(
  {
    ruleName: { type: String, required: true },
    billingClass: { type: String, required: true },
    area: {
      type: String,
      enum: ["inside", "outside", "both"],
      default: "both",
    },
    method: {
      type: String,
      enum: [
        "flat_rate",
        "base_plus_additional_mileage",
        "mileage_brackets",
        "per_mile",
        "mileage_based",
        "first_x_miles",
      ],
      required: true,
    },
    flatRate: { type: Number },
    includedMiles: { type: Number },
    baseRate: { type: Number },
    additionalMileRate: { type: Number },
    brackets: { type: [pricingRuleBracketSchema], default: undefined },
  },
  { _id: false },
);

const countySchema = new Schema<ICounty>(
  {
    payersId: {
      type: Schema.Types.ObjectId,
      ref: "Payers",
      required: true,
    },
    fundingSourceId: {
      type: Schema.Types.ObjectId,
      ref: "FundingSources",
      default: null,
    },

    name: { type: String },
    organizationType: { type: String },
    programName: { type: String },
    description: { type: String },

    geofences: { type: [geofenceSchema], default: undefined },
    coversAreasGeoJSON: {
      type: geometrySchema,
      required: false,
    },

    priceMethod: {
      type: String,
      enum: ["flat_rate", "per_mile", "mileage_based", "first_x_miles"],
      required: true,
    },

    flat_rate_price: { type: Number },
    starting_fare: { type: Number },
    first_miles_price: { type: Number },
    per_mile_price: { type: Number },
    base_rate: { type: Number },
    per_mile_rate: { type: Number },
    mileage_based_price: { type: [mileageBasedPriceSchema], default: [] },
    mileage_brackets: { type: [mileageBracketSchema], default: undefined },
    initial_miles: { type: Number },
    initial_charge: { type: Number },
    additional_per_mile: { type: Number },

    insidePrice: { type: Number },
    outsidePrice: { type: Number },

    zonePricing: { type: Schema.Types.Mixed },
    pricingRules: { type: [pricingRuleSchema], default: undefined },

    passengerCopayInside: { type: Number },
    passengerCopayOutside: { type: Number },
    authorizeCopayAtBooking: { type: Boolean },
    captureCopayAfterCompletedTrip: { type: Boolean },

    mileageSource: {
      type: String,
      enum: ["calculated_route", "actual_gps", "straight_line"],
    },
    mileageRounding: {
      type: String,
      enum: ["none", "nearest", "up", "down"],
    },
    mileagePrecision: { type: Number },
    mobilityBillingMap: {
      type: [mobilityBillingMapSchema],
      default: undefined,
    },
    chargeRules: {
      cancellation: {
        type: String,
        enum: ["none", "passenger_only", "funding_source_only", "both"],
      },
      noShow: {
        type: String,
        enum: ["none", "passenger_only", "funding_source_only", "both"],
      },
    },
    cancellationNoShow: {
      freeCancellationWindowHours: { type: Number, default: 2 },
      lateCancellationPassenger: { type: Number },
      lateCancellationFundingSource: { type: Number },
      noShowPassenger: { type: Number },
      noShowFundingSource: { type: Number },
    },

    eligibility: {
      authorizationIdRequired: { type: Boolean, default: false },
      monthlyTripLimit: { type: Number, default: 0 },
      allowAdminOverride: { type: Boolean, default: false },
      eligibilityNotes: { type: String },
    },
    programRules: {
      extraStopsAllowed: { type: Boolean, default: true },
      companionsAllowed: { type: Boolean, default: false },
      maximumCompanions: { type: Number },
      companionCharge: { type: Number },
      tripReasons: { type: [tripReasonSchema], default: undefined },
    },
    reporting: {
      templateName: { type: String },
      columns: { type: [String], default: undefined },
      complaintResponseDeadlineHours: { type: Number, default: 72 },
      safetyIncidentReportingDeadlineHours: { type: Number, default: 24 },
    },

    effectiveFrom: { type: String },
    effectiveTo: { type: String },

    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

countySchema.index({ "geofences.geometry": "2dsphere" });
countySchema.index({ coversAreasGeoJSON: "2dsphere" });
countySchema.index({ payersId: 1 });
countySchema.index({ fundingSourceId: 1 });

export const County = model<ICounty>("County", countySchema);
