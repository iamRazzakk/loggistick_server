import fs from "fs";
import { NextFunction, Request, Response } from "express";
export const parseCountyUpload = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (req.body.data && typeof req.body.data === "string") {
    try {
      const parsedData = JSON.parse(req.body.data);
      Object.assign(req.body, parsedData);
    } catch (e) {
      // ignore
    }
  }

  if (typeof req.body.baseFare === "string") {
    req.body.baseFare = Number(req.body.baseFare);
  }
  if (typeof req.body.isActive === "string") {
    req.body.isActive = req.body.isActive === "true";
  }

  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const uploadedFile = files?.file?.[0] || files?.doc?.[0];

  if (uploadedFile) {
    try {
      const fileContent = fs.readFileSync(uploadedFile.path, "utf-8");
      const geoJson = JSON.parse(fileContent);

      let geometry = null;
      let extractedName = null;

      if (
        geoJson.type === "FeatureCollection" &&
        Array.isArray(geoJson.features) &&
        geoJson.features.length > 0
      ) {
        const feature = geoJson.features[0];
        geometry = feature.geometry;
        const props = feature.properties || {};
        extractedName = props.name || props.JURIS || props.Locality;
      } else if (geoJson.type === "Feature") {
        geometry = geoJson.geometry;
        const props = geoJson.properties || {};
        extractedName = props.name || props.JURIS || props.Locality;
      } else if (geoJson.coordinates && geoJson.type) {
        geometry = geoJson;
      }

      if (geometry) {
        req.body.boundary = geometry;
      }
      if (!req.body.name && extractedName) {
        req.body.name = extractedName;
      }
    } catch (error) {
      console.error("Failed to parse uploaded GeoJSON file:", error);
    }
  } else if (typeof req.body.boundary === "string") {
    try {
      req.body.boundary = JSON.parse(req.body.boundary);
    } catch (e) {
      // ignore
    }
  }

  next();
};
