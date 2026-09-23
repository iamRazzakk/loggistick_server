import { StatusCodes } from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import ApiError from "../../../errors/ApiErrors";
import QueryBuilder from "../../builder/queryBuilder";
import { IReports } from "./reports.interface";
import { Reports } from "./reports.model";
import { Booking } from "../booking/booking.model";
const createReportIntoDB = async (user: JwtPayload, payload: IReports) => {
  payload.reportedBy = user.id;
  const report = await Reports.create(payload);
  if (!report) {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Failed to create report",
    );
  }
  return report;
};
const getAllReportsFromDB = async (query: Record<string, any>) => {
  const { tripType, ...restQuery } = query;
  const filter: Record<string, unknown> = {};
  if (tripType) {
    const tripIds = await Booking.find({ tripType }).distinct("_id");
    filter.tripId = { $in: tripIds };
  }
  const qb = new QueryBuilder(
    Reports.find(filter).populate("tripId"),
    restQuery,
  )
    .search(["reportStatus"])
    .fields()
    .filter()
    .sort()
    .paginate();
  const [data, meta] = await Promise.all([
    qb.modelQuery.exec(),
    qb.getPaginationInfo(),
  ]);
  return { data, meta };
};
const getMyReportsFromDB = async (
  user: JwtPayload,
  query: Record<string, any>,
) => {
  const qb = new QueryBuilder(
    Reports.find({ reportedBy: user.id }).populate("tripId"),
    query,
  )
    .fields()
    .filter()
    .sort()
    .paginate();
  const [data, meta] = await Promise.all([
    qb.modelQuery.exec(),
    qb.getPaginationInfo(),
  ]);
  return { data, meta };
};
const getReportByIdFromDB = async (id: string) => {
  const report = await Reports.findById(id).populate("tripId");
  if (!report) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Report not found");
  }
  return report;
};
const updateReportInDB = async (id: string, payload: Partial<IReports>) => {
  const report = await Reports.findByIdAndUpdate(id, payload, { new: true });
  if (!report) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Report not found");
  }
  return report;
};
const deleteReportFromDB = async (id: string) => {
  const report = await Reports.findByIdAndDelete(id);
  if (!report) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Report not found");
  }
  return report;
};
export const ReportsServices = {
  createReportIntoDB,
  getAllReportsFromDB,
  getMyReportsFromDB,
  getReportByIdFromDB,
  updateReportInDB,
  deleteReportFromDB,
};
