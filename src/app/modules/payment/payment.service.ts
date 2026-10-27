import QueryBuilder from "../../builder/queryBuilder";
import { Payment } from "./payment.model";
import { PaymentExportRow, paymentTable } from "./payment.export";
import {
  exportTypeFromQuery,
  writeTabularExport,
} from "../../../shared/tabularExport";
import { runExportJob } from "../../../helpers/runExportJob";
import { EXPORT_PAYMENTS_JOB } from "../../../queue/export.queue";

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

export const buildPaymentFile = async (query: Record<string, any>) => {
  const payments = await Payment.find()
    .populate("userId", "email firstName lastName")
    .lean();

  return writeTabularExport({
    format: exportTypeFromQuery(query),
    ...paymentTable(payments as PaymentExportRow[]),
  });
};

const exportAllPaymentsDataInExcelFormatFromDB = (query: Record<string, any>) =>
  runExportJob(EXPORT_PAYMENTS_JOB, { query });

export const PaymentServices = {
  getAllPaymentsFromDB,
  getPaymentOverViewFromDB,
  exportAllPaymentsDataInExcelFormatFromDB,
};
