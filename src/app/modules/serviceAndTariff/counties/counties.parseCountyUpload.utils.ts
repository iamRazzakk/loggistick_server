import fs from "fs";
import path from "path";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../../../errors/ApiErrors";
import {
  extractGeofencesFromGeoJson,
  geofencesFromLegacyPolygon,
  unionGeometryFromGeofences,
} from "./counties.geofence.utils";
import {
  defaultPriceMethodFromRules,
  zonePricingFromPricingRules,
} from "./counties.pricingRules.utils";
import { sanitizeCountyPayloadByPriceMethod } from "./counties.sanitizeByPriceMethod.utils";
import { IGeofence, IGeoJSONPolygon } from "./counties.interface";

const NUMBER_FIELDS = [
  "flat_rate_price",
  "starting_fare",
  "first_miles_price",
  "per_mile_price",
  "base_rate",
  "per_mile_rate",
  "initial_miles",
  "initial_charge",
  "additional_per_mile",
  "passengerCopayInside",
  "passengerCopayOutside",
  "mileagePrecision",
  "insidePrice",
  "outsidePrice",
] as const;

const JSON_FIELDS = [
  "mileage_based_price",
  "mileage_brackets",
  "zonePricing",
  "mobilityBillingMap",
  "chargeRules",
  "geofences",
  "pricingRules",
  "eligibility",
  "programRules",
  "cancellationNoShow",
  "reporting",
  "coversAreasGeoJSON",
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

const assertJsonUpload = (filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext && ![".json", ".geojson"].includes(ext)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Geofence upload must be JSON only (.json or .geojson). Shapefiles are not supported.",
    );
  }
};

const normalizeGeofences = (body: Record<string, unknown>) => {
  let geofences = body.geofences as IGeofence[] | undefined;

  if (Array.isArray(geofences) && geofences.length) {
    geofences = geofences.map((fence, index) => ({
      name: fence.name?.trim() || `Geofence ${index + 1}`,
      geometry: fence.geometry,
      isActive: fence.isActive !== false,
    }));
  } else if (body.coversAreasGeoJSON) {
    geofences = geofencesFromLegacyPolygon(
      body.coversAreasGeoJSON as IGeoJSONPolygon,
    );
  }

  if (geofences?.length) {
    body.geofences = geofences;
    const union = unionGeometryFromGeofences(geofences);
    if (union) body.coversAreasGeoJSON = union;
  }
};

export const parseCountyUpload = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    if (typeof req.body.data === "string") {
      const parsedData = parseJsonField(req.body.data);
      if (parsedData && typeof parsedData === "object") {
        Object.assign(req.body, parsedData);
      }
      delete req.body.data;
    }

    for (const field of JSON_FIELDS) {
      req.body[field] = parseJsonField(req.body[field]);
    }

    for (const field of NUMBER_FIELDS) {
      req.body[field] = coerceNumber(req.body[field]);
    }

    if (Array.isArray(req.body.mileage_based_price)) {
      req.body.mileage_based_price = req.body.mileage_based_price.map(
        (item: Record<string, unknown>) => {
          if (item && typeof item === "object") {
            return {
              starting_mileage: coerceNumber(item.starting_mileage),
              first_miles_price: coerceNumber(item.first_miles_price),
              per_mile_price: coerceNumber(item.per_mile_price),
            };
          }
          return item;
        },
      );
    } else if (
      req.body.mileage_based_price &&
      typeof req.body.mileage_based_price === "object"
    ) {
      const mileage = req.body.mileage_based_price as Record<string, unknown>;
      mileage.starting_mileage = coerceNumber(mileage.starting_mileage);
      mileage.first_miles_price = coerceNumber(mileage.first_miles_price);
      mileage.per_mile_price = coerceNumber(mileage.per_mile_price);
      req.body.mileage_based_price = mileage;
    }

    req.body.isActive = coerceBoolean(req.body.isActive);
    req.body.authorizeCopayAtBooking = coerceBoolean(
      req.body.authorizeCopayAtBooking,
    );
    req.body.captureCopayAfterCompletedTrip = coerceBoolean(
      req.body.captureCopayAfterCompletedTrip,
    );

    const files = req.files as
      | Record<string, Express.Multer.File[]>
      | undefined;
    const uploadedFile = files?.file?.[0] || files?.doc?.[0];

    if (uploadedFile) {
      assertJsonUpload(uploadedFile.originalname || uploadedFile.path);
      const fileContent = fs.readFileSync(uploadedFile.path, "utf-8");
      let geoJson: unknown;
      try {
        geoJson = JSON.parse(fileContent);
      } catch {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Geofence file must be valid JSON (.json / .geojson)",
        );
      }
      req.body.geofences = extractGeofencesFromGeoJson(geoJson);
    }

    normalizeGeofences(req.body);

    if (Array.isArray(req.body.pricingRules) && req.body.pricingRules.length) {
      const method = defaultPriceMethodFromRules(
        req.body.pricingRules,
        req.body.priceMethod as never,
      );
      if (method && !req.body.priceMethod) {
        req.body.priceMethod = method;
      }
      req.body.zonePricing = zonePricingFromPricingRules(
        req.body.pricingRules,
        req.body.zonePricing,
      );

      // Top-level fare fields required by Zod when priceMethod is set.
      const first = req.body.pricingRules[0] as {
        method?: string;
        flatRate?: number;
        includedMiles?: number;
        baseRate?: number;
        additionalMileRate?: number;
        brackets?: Array<{ from: number; to?: number | null; amount: number }>;
      };
      if (req.body.priceMethod === "flat_rate" && req.body.flat_rate_price == null) {
        req.body.flat_rate_price = Number(first?.flatRate) || 0;
      }
      if (req.body.priceMethod === "first_x_miles") {
        if (req.body.initial_miles == null) {
          req.body.initial_miles = Number(first?.includedMiles) || 0;
        }
        if (req.body.initial_charge == null) {
          req.body.initial_charge = Number(first?.baseRate) || 0;
        }
        if (req.body.additional_per_mile == null) {
          req.body.additional_per_mile = Number(first?.additionalMileRate) || 0;
        }
      }
      if (
        req.body.priceMethod === "mileage_based" &&
        !req.body.mileage_brackets &&
        Array.isArray(first?.brackets)
      ) {
        req.body.mileage_brackets = first.brackets.map((band) => ({
          min_mileage: band.from,
          max_mileage: band.to ?? null,
          charge: band.amount,
        }));
      }
    }

    Object.keys(req.body).forEach((key) => {
      if (req.body[key] === "") {
        delete req.body[key];
      }
    });

    req.body = sanitizeCountyPayloadByPriceMethod(req.body);

    next();
  } catch (error) {
    next(error);
  }
};
