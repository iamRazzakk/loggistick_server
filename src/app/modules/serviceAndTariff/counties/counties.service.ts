import fs from "fs";
import path from "path";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../../../errors/ApiErrors";
import { ICounty } from "./counties.interface";
import { County } from "./counties.model";
import { redisService } from "../../../../redis/redis.service";

const createCountiesIntoDB = async (payload: ICounty) => {
  const result = await County.create(payload);
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to create county");
  }
  await redisService.del(`counties`);
  return result;
};

const getAllCountiesFromDB = async () => {
  const cachedCounties = await redisService.get(`counties`);
  if (cachedCounties) {
    console.log("==========>>>From cache");
    return JSON.parse(cachedCounties);
  }
  const result = await County.find().select("name state").lean();
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to get counties");
  }
  await redisService.post({
    key: "counties",
    value: JSON.stringify(result),
    expiration: 24 * 60 * 60, // 24 hours
  });
  console.log("==========>>>From DB");
  return result;
};
// all county for admin
const getAllCountiesForAdmin = async () => {
  const cachedCounties = await redisService.get(`counties-for-admin`);
  if (cachedCounties) {
    console.log("==========>>>From cache");
    return JSON.parse(cachedCounties);
  }
  const result = await County.find().lean();
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to get counties");
  }
  await redisService.post({
    key: "counties-for-admin",
    value: JSON.stringify(result),
    expiration: 24 * 60 * 60, // 24 hours
  });
  console.log("==========>>>From DB");
  return result;
};

const getSingleCountyFromDB = async (id: string) => {
  const result = await County.findById(id).lean();
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to get county");
  }
  return result;
};

const updateCountiesFromDB = async (id: string, payload: Partial<ICounty>) => {
  const result = await County.findByIdAndUpdate(id, payload, { new: true });
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to update county");
  }
  await redisService.del(`counties`);
  return result;
};

const deleteCountiesFromDB = async (id: string) => {
  const result = await County.deleteOne({ _id: id });
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to delete county");
  }
  await redisService.del(`counties`);
  return result;
};

const findCountyByLocationFromDB = async (lng: number, lat: number) => {
  if (isNaN(lng) || isNaN(lat)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Invalid longitude or latitude coordinates",
    );
  }

  const result = await County.find({
    isActive: true,
    boundary: {
      $geoIntersects: {
        $geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
      },
    },
  }).lean();

  return result;
};

const seedCountiesFromGeoFenceIntoDB = async () => {
  const geoFenceDir = path.join(process.cwd(), "src", "geoFence");
  if (!fs.existsSync(geoFenceDir)) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      `Directory ${geoFenceDir} not found`,
    );
  }

  const files = fs.readdirSync(geoFenceDir);
  const jsonFiles = files.filter(
    (file) => file.endsWith(".json") || file.endsWith(".geojson"),
  );

  let insertedCount = 0;
  let updatedCount = 0;
  const processedNames = new Set<string>();

  for (const file of jsonFiles) {
    const filePath = path.join(geoFenceDir, file);
    try {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const geoJson = JSON.parse(fileContent);

      if (!geoJson.features || !Array.isArray(geoJson.features)) {
        continue;
      }

      for (const feature of geoJson.features) {
        const props = feature.properties || {};
        const name =
          props.Locality || props.name || props.JURIS || props.boundary_type;
        if (!name || !feature.geometry) continue;

        // Skip non-WGS84 EPSG:2284 coordinate features (e.g. coordinates > 180)
        let sampleCoord: number[] | null = null;
        if (feature.geometry.type === "Polygon") {
          sampleCoord = feature.geometry.coordinates?.[0]?.[0];
        } else if (feature.geometry.type === "MultiPolygon") {
          sampleCoord = feature.geometry.coordinates?.[0]?.[0]?.[0];
        }
        if (
          sampleCoord &&
          (Math.abs(sampleCoord[0]) > 180 || Math.abs(sampleCoord[1]) > 90)
        ) {
          continue;
        }

        const countyData: Partial<ICounty> = {
          name: name.trim(),
          state: props.state || "VA",
          baseFare: 0,
          internalNotes: "",
          boundary: {
            type: feature.geometry.type,
            coordinates: feature.geometry.coordinates,
          },
          isActive: true,
        };

        const existing = await County.findOne({ name: countyData.name });
        if (existing) {
          await County.updateOne({ _id: existing._id }, countyData);
          updatedCount++;
        } else {
          await County.create(countyData);
          insertedCount++;
        }
        processedNames.add(countyData.name!);
      }
    } catch (error) {
      console.error(`Failed to process geoFence file ${file}:`, error);
    }
  }

  await redisService.del(`counties`);

  return {
    message: "Geofence counties seeded successfully",
    insertedCount,
    updatedCount,
    totalProcessed: processedNames.size,
    processedCounties: Array.from(processedNames),
  };
};

export const CountiesService = {
  createCountiesIntoDB,
  getAllCountiesFromDB,
  getSingleCountyFromDB,
  updateCountiesFromDB,
  deleteCountiesFromDB,
  findCountyByLocationFromDB,
  seedCountiesFromGeoFenceIntoDB,
  getAllCountiesForAdmin,
};
