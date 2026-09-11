import { Types } from "mongoose";

export interface IMileageBasedPrice {
  starting_mileage: number;
  first_miles_price: number;
  per_mile_price: number;
}

// GeoJSON Polygon
export interface IGeoJSONPolygon {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][]; // [ [ [lng, lat], ... ] ]
}

export interface ICounty {
  payersId: Types.ObjectId;
  coversAreasGeoJSON: IGeoJSONPolygon;

  priceMethod: "flat_rate" | "per_mile" | "mileage_based";

  // flat_rate_price
  flat_rate_price?: number;

  // per_mile_price
  starting_fare?: number;
  first_miles_price?: number;
  per_mile_price?: number;

  // mileage based price
  mileage_based_price?: IMileageBasedPrice;

  insidePrice?: number;
  outsidePrice?: number;
  isActive: boolean;
}
