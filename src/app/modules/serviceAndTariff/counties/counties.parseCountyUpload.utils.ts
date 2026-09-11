import fs from "fs";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../../../errors/ApiErrors";
import { sanitizeCountyPayloadByPriceMethod } from "./counties.sanitizeByPriceMethod.utils";

const NUMBER_FIELDS = [
  "flat_rate_price",
  "starting_fare",
  "first_miles_price",
  "per_mile_price",
  "insidePrice",
  "outsidePrice",
] as const;

const parseJsonField = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const coerceNumber = (value: unknown) => {
  if (typeof value !== "string") return value;
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};

const coerceBoolean = (value: unknown) => {
  if (typeof value !== "string") return value;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return value;
};

const extractGeometryFromGeoJson = (geoJson: any) => {
  if (
    geoJson?.type === "FeatureCollection" &&
    Array.isArray(geoJson.features) &&
    geoJson.features.length > 0
  ) {
    return geoJson.features[0]?.geometry ?? null;
  }

  if (geoJson?.type === "Feature") {
    return geoJson.geometry ?? null;
  }

  if (
    geoJson?.coordinates &&
    (geoJson.type === "Polygon" || geoJson.type === "MultiPolygon")
  ) {
    return geoJson;
  }

  return null;
};

export const parseCountyUpload = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    // FormData: whole payload as JSON string in `data`
    if (typeof req.body.data === "string") {
      const parsedData = parseJsonField(req.body.data);
      if (parsedData && typeof parsedData === "object") {
        Object.assign(req.body, parsedData);
      }
      delete req.body.data;
    }

    // Nested JSON string fields from FormData
    req.body.coversAreasGeoJSON = parseJsonField(req.body.coversAreasGeoJSON);
    req.body.mileage_based_price = parseJsonField(req.body.mileage_based_price);

    for (const field of NUMBER_FIELDS) {
      req.body[field] = coerceNumber(req.body[field]);
    }

    if (req.body.mileage_based_price && typeof req.body.mileage_based_price === "object") {
      const mileage = req.body.mileage_based_price as Record<string, unknown>;
      mileage.starting_mileage = coerceNumber(mileage.starting_mileage);
      mileage.first_miles_price = coerceNumber(mileage.first_miles_price);
      mileage.per_mile_price = coerceNumber(mileage.per_mile_price);
      req.body.mileage_based_price = mileage;
    }

    req.body.isActive = coerceBoolean(req.body.isActive);

    // GeoJSON file upload (field: file | doc)
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const uploadedFile = files?.file?.[0] || files?.doc?.[0];

    if (uploadedFile) {
      const fileContent = fs.readFileSync(uploadedFile.path, "utf-8");
      const geoJson = JSON.parse(fileContent);
      const geometry = extractGeometryFromGeoJson(geoJson);

      if (!geometry) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Uploaded file must be a valid GeoJSON Polygon or MultiPolygon",
        );
      }

      req.body.coversAreasGeoJSON = geometry;
    }

    // Remove empty string leftovers from FormData
    Object.keys(req.body).forEach((key) => {
      if (req.body[key] === "") {
        delete req.body[key];
      }
    });

    // Keep only fields that belong to the selected priceMethod
    req.body = sanitizeCountyPayloadByPriceMethod(req.body);

    next();
  } catch (error) {
    next(error);
  }
};
