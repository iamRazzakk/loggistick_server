import { model, Schema } from "mongoose";
import { ICounty } from "./counties.interface";

const countySchema = new Schema<ICounty>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    state: {
      type: String,
      required: true,
      default: "VA",
      trim: true,
    },

    baseFare: {
      type: Number,
      required: true,
      default: 0,
    },

    internalNotes: {
      type: String,
      trim: true,
    },

    // Geographic boundary (GeoJSON Polygon or MultiPolygon)
    boundary: {
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

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

countySchema.index({
  boundary: "2dsphere",
});

export const County = model<ICounty>("County", countySchema);

