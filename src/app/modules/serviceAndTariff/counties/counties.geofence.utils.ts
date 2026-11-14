import { StatusCodes } from "http-status-codes";
import ApiError from "../../../../errors/ApiErrors";
import { IGeofence, IGeoJSONPolygon } from "./counties.interface";

const isGeometry = (value: unknown): value is IGeoJSONPolygon => {
  if (!value || typeof value !== "object") return false;
  const geo = value as { type?: string; coordinates?: unknown };
  return (
    (geo.type === "Polygon" || geo.type === "MultiPolygon") &&
    Array.isArray(geo.coordinates)
  );
};

const looksLikeWgs84Ring = (ring: unknown): boolean => {
  if (!Array.isArray(ring) || !ring.length) return false;
  const first = ring[0];
  if (!Array.isArray(first) || first.length < 2) return false;
  const lng = Number(first[0]);
  const lat = Number(first[1]);
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    Math.abs(lng) <= 180 &&
    Math.abs(lat) <= 90
  );
};

export const assertWgs84Geometry = (geometry: IGeoJSONPolygon, label: string) => {
  const sample =
    geometry.type === "Polygon"
      ? geometry.coordinates?.[0]
      : geometry.coordinates?.[0]?.[0];
  if (!looksLikeWgs84Ring(sample)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `${label} must use WGS84 lon/lat coordinates (JSON GeoJSON only). Projected CRS uploads are not supported.`,
    );
  }
};

const featureName = (
  properties: Record<string, unknown> | undefined,
  index: number,
) => {
  const raw =
    properties?.name ??
    properties?.Locality ??
    properties?.JURIS ??
    properties?.MunicipalType;
  if (raw != null && String(raw).trim()) return String(raw).trim();
  return `Geofence ${index + 1}`;
};

/**
 * Parse GeoJSON JSON (FeatureCollection / Feature / Polygon / MultiPolygon)
 * into named geofence rows. Does not accept shapefiles.
 */
export const extractGeofencesFromGeoJson = (geoJson: unknown): IGeofence[] => {
  if (!geoJson || typeof geoJson !== "object") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Uploaded file must be valid GeoJSON JSON",
    );
  }

  const doc = geoJson as {
    type?: string;
    features?: unknown[];
    geometry?: unknown;
    coordinates?: unknown;
    properties?: Record<string, unknown>;
    crs?: { properties?: { name?: string } };
  };

  const crsName = doc.crs?.properties?.name ?? "";
  if (crsName && !/crs84|4326|wgs.?84/i.test(crsName) && /EPSG:\d+/i.test(crsName)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Unsupported CRS ${crsName}. Upload WGS84 GeoJSON (.json / .geojson) only.`,
    );
  }

  const fences: IGeofence[] = [];

  if (doc.type === "FeatureCollection" && Array.isArray(doc.features)) {
    doc.features.forEach((feature, index) => {
      if (!feature || typeof feature !== "object") return;
      const feat = feature as {
        geometry?: unknown;
        properties?: Record<string, unknown>;
      };
      if (!isGeometry(feat.geometry)) return;
      assertWgs84Geometry(feat.geometry, `Feature ${index + 1}`);
      fences.push({
        name: featureName(feat.properties, index),
        geometry: feat.geometry,
        isActive: true,
      });
    });
  } else if (doc.type === "Feature") {
    if (!isGeometry(doc.geometry)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Feature geometry must be Polygon or MultiPolygon",
      );
    }
    assertWgs84Geometry(doc.geometry, "Feature");
    fences.push({
      name: featureName(doc.properties, 0),
      geometry: doc.geometry,
      isActive: true,
    });
  } else if (isGeometry(doc)) {
    assertWgs84Geometry(doc, "Geometry");
    fences.push({
      name: "Geofence 1",
      geometry: doc,
      isActive: true,
    });
  }

  if (!fences.length) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Uploaded JSON must include at least one Polygon or MultiPolygon feature",
    );
  }

  return fences;
};

/** Legacy single polygon → one geofence row. */
export const geofencesFromLegacyPolygon = (
  geometry: IGeoJSONPolygon | undefined | null,
  name = "Primary",
): IGeofence[] => {
  if (!geometry || !isGeometry(geometry)) return [];
  return [{ name, geometry, isActive: true }];
};

/**
 * Denormalized MultiPolygon (or single Polygon) covering all active fences
 * so legacy `$geoIntersects` on coversAreasGeoJSON still works.
 */
export const unionGeometryFromGeofences = (
  geofences: IGeofence[] | undefined,
): IGeoJSONPolygon | undefined => {
  const active = (geofences ?? []).filter(
    (fence) => fence.isActive !== false && isGeometry(fence.geometry),
  );
  if (!active.length) return undefined;
  if (active.length === 1) return active[0].geometry;

  const polygons: number[][][][] = [];
  for (const fence of active) {
    if (fence.geometry.type === "Polygon") {
      polygons.push(fence.geometry.coordinates as number[][][]);
    } else {
      polygons.push(...(fence.geometry.coordinates as number[][][][]));
    }
  }
  return { type: "MultiPolygon", coordinates: polygons as unknown as number[][][] };
};

/** Mongo filter: point inside any active geofence OR legacy coversAreasGeoJSON. */
export const countyPointGeoFilter = (point: [number, number]) => {
  const geometry = { type: "Point" as const, coordinates: point };
  return {
    $or: [
      {
        geofences: {
          $elemMatch: {
            isActive: { $ne: false },
            geometry: { $geoIntersects: { $geometry: geometry } },
          },
        },
      },
      {
        coversAreasGeoJSON: {
          $geoIntersects: { $geometry: geometry },
        },
      },
    ],
  };
};
