import { ExportCell, ExportColumn } from "../../../shared/tabularExport";
import { displayName } from "../../../util/formatText";

type PaymentUser = {
  email?: string;
  firstName?: string;
  lastName?: string;
} | null;

export type PaymentExportRow = {
  txnNumber?: string;
  price?: number;
  paymentStatus?: string;
  userId?: PaymentUser;
  bookingId?: unknown;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type PaymentColumn = ExportColumn & {
  pick: (payment: PaymentExportRow) => ExportCell;
};

const text = (value?: string | number | null) => value ?? "";

const COLUMNS: PaymentColumn[] = [
  {
    header: "Txn Number",
    key: "txnNumber",
    width: 24,
    pick: (payment) => text(payment.txnNumber),
  },
  {
    header: "Price",
    key: "price",
    width: 12,
    pick: (payment) => text(payment.price),
  },
  {
    header: "Payment Status",
    key: "paymentStatus",
    width: 18,
    pick: (payment) => text(payment.paymentStatus),
  },
  {
    header: "Email",
    key: "userEmail",
    width: 28,
    pick: (payment) => payment.userId?.email ?? "",
  },
  {
    header: "Name",
    key: "userName",
    width: 24,
    pick: (payment) => displayName(payment.userId),
  },
  {
    header: "Booking Id",
    key: "bookingId",
    width: 28,
    pick: (payment) => String(payment.bookingId ?? ""),
  },
  {
    header: "Created At",
    key: "createdAt",
    width: 22,
    pick: (payment) =>
      payment.createdAt ? new Date(payment.createdAt).toLocaleString() : "",
  },
];

export const paymentTable = (payments: PaymentExportRow[]) => ({
  sheetName: "Payments",
  filename: "payments",
  columns: COLUMNS.map(({ header, key, width }) => ({ header, key, width })),
  rows: payments.map((payment) =>
    Object.fromEntries(
      COLUMNS.map((column) => [column.key, column.pick(payment)]),
    ),
  ),
});
