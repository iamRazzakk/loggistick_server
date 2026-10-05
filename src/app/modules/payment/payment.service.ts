import ApiError from "../../../errors/ApiErrors";
import { logger } from "../../../shared/logger";
import QueryBuilder from "../../builder/queryBuilder";
import { Payment } from "./payment.model";
import ExcelJS from "exceljs";
import { StatusCodes } from "http-status-codes";

const getAllPaymentsFromDB = async (query: Record<string, any>) => {
  const qb = new QueryBuilder(Payment.find(), query)
    .filter()
    .search(["txnNumber", "paymentStatus"])
    .sort()
    .paginate()
    .populate(["userId"], {
      userId: "email firstName middleName lastName profile contact",
    });
  const [data, meta] = await Promise.all([
    qb.modelQuery.lean(),
    qb.getPaginationInfo(),
  ]);
  return { data, meta };
};

// over view payment

const getPaymentOverViewFromDB = async () => {
  const totalPayments = await Payment.find().select("price").lean();
  const totalAmount = totalPayments.reduce((acc, curr) => acc + curr.price, 0);
  return totalAmount;
};

// export all data in excel formate
const exportAllPaymentsDataInExcelFormatFromDB = async () => {
  const payments = await Payment.find()
    .populate("userId", "email firstName middleName lastName")
    .lean();

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Payments");

  worksheet.columns = [
    { header: "Txn Number", key: "txnNumber", width: 24 },
    { header: "Price", key: "price", width: 12 },
    { header: "Payment Status", key: "paymentStatus", width: 18 },
    { header: "User Email", key: "userEmail", width: 28 },
    { header: "User Name", key: "userName", width: 24 },
    { header: "Booking Id", key: "bookingId", width: 28 },
    { header: "Created At", key: "createdAt", width: 22 },
  ];

  payments.forEach((payment) => {
    const user = payment.userId as {
      email?: string;
      firstName?: string;
      middleName?: string;
      lastName?: string;
    } | null;

    const userName = [user?.firstName, user?.middleName, user?.lastName]
      .filter(Boolean)
      .join(" ");

    worksheet.addRow({
      txnNumber: payment.txnNumber,
      price: payment.price,
      paymentStatus: payment.paymentStatus,
      userEmail: user?.email ?? "",
      userName,
      bookingId: String(payment.bookingId),
      createdAt: (payment as any).createdAt
        ? new Date((payment as any).createdAt).toISOString()
        : "",
    });
  });

  worksheet.getRow(1).font = { bold: true };

  return workbook.xlsx
    .writeBuffer()
    .then((buffer) => Buffer.from(buffer).toString("base64"))
    .catch((error) => {
      logger.error(
        `Error exporting all payments data in excel format: ${error}`,
      );
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Error exporting all payments data in excel format",
      );
    });
};

export const PaymentServices = {
  getAllPaymentsFromDB,
  getPaymentOverViewFromDB,
  exportAllPaymentsDataInExcelFormatFromDB,
};
