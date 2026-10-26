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
    mobilityId: { type: Schema.Types.ObjectId, ref: "Mobility", required: true },
    billingClass: { type: String, required: true },
  },
  { _id: false },
);

const coversAreasGeoJSONSchema = new Schema(
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

const countySchema = new Schema<ICounty>(
  {
    payersId: {
      type: Schema.Types.ObjectId,
      ref: "Payers",
      required: true,
    },

    coversAreasGeoJSON: {
      type: coversAreasGeoJSONSchema,
      required: true,
    },

    priceMethod: {
      type: String,
      enum: ["flat_rate", "per_mile", "mileage_based", "first_x_miles"],
      required: true,
    },

    // flat_rate
    flat_rate_price: { type: Number },

    // per_mile
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
    passengerCopayInside: { type: Number },
    passengerCopayOutside: { type: Number },
    mileageSource: {
      type: String,
      enum: ["calculated_route", "actual_gps", "straight_line"],
    },
    mileageRounding: {
      type: String,
      enum: ["none", "nearest", "up", "down"],
    },
    mileagePrecision: { type: Number },
    mobilityBillingMap: { type: [mobilityBillingMapSchema], default: undefined },
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

// Geo queries ($geoIntersects / $geoWithin)
countySchema.index({ coversAreasGeoJSON: "2dsphere" });
countySchema.index({ payersId: 1 });

export const County = model<ICounty>("County", countySchema);
