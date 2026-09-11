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
      enum: ["flat_rate", "per_mile", "mileage_based"],
      required: true,
    },

    // flat_rate
    flat_rate_price: { type: Number },

    // per_mile
    starting_fare: { type: Number },
    first_miles_price: { type: Number },
    per_mile_price: { type: Number },

    // mileage_based (single object — interface onujayi)
    mileage_based_price: {
      type: mileageBasedPriceSchema,
    },

    insidePrice: { type: Number },
    outsidePrice: { type: Number },

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
