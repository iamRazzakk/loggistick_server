import { StatusCodes } from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import ApiError from "../../../errors/ApiErrors";
import QueryBuilder from "../../builder/queryBuilder";
import { IReports } from "./reports.interface";
import { Reports } from "./reports.model";
import { Booking } from "../booking/booking.model";
import { User } from "../user/user.model";
import { randomUUID } from "crypto";
import { emailTemplate } from "../../../shared/emailTemplate";
import { reportAssignedQueue } from "../../../queue/email.queue";
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
    Reports.find(filter).populate([
      { path: "tripId", select: "tripType" },
      { path: "reportedBy", select: "firstName middleName lastName email" },
      { path: "userId", select: "firstName middleName lastName email" },
    ]),
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
  const reportData = await Reports.findById(id).lean<IReports>();
  if (!reportData) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Report not found");
  }

  const isNewlyAssigned =
    Boolean(payload.assignedUserId) &&
    reportData.assignedUserId?.toString() !==
      payload.assignedUserId?.toString();

  const isNoteUpdated =
    Boolean(payload.internalNote) &&
    payload.internalNote !== reportData.internalNote;

  const targetUserId = payload.assignedUserId || reportData.assignedUserId;

  let assignedUser: any = null;
  if ((isNewlyAssigned || isNoteUpdated) && targetUserId) {
    assignedUser = await User.findById(targetUserId);
  }

  const report = await Reports.findByIdAndUpdate(id, payload, { new: true });
  if (!report) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Report not found");
  }

  if ((isNewlyAssigned || isNoteUpdated) && assignedUser) {
    const emailJobId = randomUUID();
    const fullName = [assignedUser.firstName, assignedUser.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    const subject = isNewlyAssigned
      ? "Report assigned to you"
      : "Report update: New note added";

    const createReportTemplate = emailTemplate.reportAssigned({
      email: assignedUser.email,
      name: fullName || "User",
      reportId: `#LOGISS-${report._id.toString().slice(-6)}`,
      reportTitle: report.reason,
      reportDescription: report.internalNote || "",
      reportStatus: report.reportStatus,
      reportCreatedAt:
        (report as any).createdAt?.toLocaleString() ||
        new Date().toLocaleString(),
    });

    const emailData = {
      jobId: emailJobId,
      to: createReportTemplate.to,
      subject: subject,
      html: createReportTemplate.html,
      type: "report_assigned",
    };

    await reportAssignedQueue.add("report-assigned", emailData);
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
