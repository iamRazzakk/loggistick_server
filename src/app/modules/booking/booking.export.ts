import { format } from "date-fns";
import { USER_ROLES } from "../../../enums/user";
import { ExportCell, ExportColumn } from "../../../shared/tabularExport";
import { displayName, joinList } from "../../../util/formatText";

type NamedPerson = { firstName?: string; lastName?: string } | null;
type NamedRecord = { name?: string; type?: string } | null;
type CountyPayer = { payersId?: NamedRecord | null } | null;

export type TripHistoryBooking = {
  _id: unknown;
  userId?: NamedPerson;
  driverId?: NamedPerson;
  mobilityRequirements?: NamedRecord;
  payerSource?: NamedRecord;
  pickupLocation?: number[];
  dropOffLocation?: number[];
  stopAddress?: number[];
  tripType?: string;
  tripReason?: string;
  passengerSeats?: number;
  serviceDate?: string;
  appointmentTime?: string;
  pickupTime?: string;
  returnTime?: string;
  driverArrivedAt?: string;
  driverPicupAt?: string;
  recurringBooking?: boolean;
  selectedDate?: string | string[];
  endDate?: string;
  recurringBatchId?: string;
  tripNote?: string;
  internalPrivateNote?: string;
  programContext?: string;
  countyId?: CountyPayer | unknown;
  totalPrice?: number;
  calculatedRouteMileage?: number | null;
  actualGpsMileage?: number | null;
  straightLineMileage?: number | null;
  billingMileage?: number | null;
  billingMileageSource?: string;
  cancellationOutcome?: string;
  noShowOutcome?: string;
  bookingStatus?: string;
  price?: number;
  passengerCoPay?: number;
  organizationContribution?: number;
  isApproved?: string;
  paymentStatus?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type TripColumn = ExportColumn & {
  hiddenFrom?: string;
  pick: (booking: TripHistoryBooking) => ExportCell;
};

const text = (value?: string | number | null) => value ?? "";

const localIso = (value?: Date | string) =>
  value ? format(new Date(value), "yyyy-MM-dd'T'HH:mm:ssXXX") : "";

const dayList = (value?: string | string[]) =>
  joinList(Array.isArray(value) ? value : value ? [value] : []);

const fundingSource = (booking: TripHistoryBooking): NamedRecord => {
  if (booking.payerSource?.name || booking.payerSource?.type) {
    return booking.payerSource;
  }
  const county =
    booking.countyId &&
    typeof booking.countyId === "object" &&
    booking.countyId !== null
      ? (booking.countyId as CountyPayer)
      : null;
  const payer = county && typeof county === "object" ? county.payersId : null;
  return payer && typeof payer === "object" ? payer : null;
};

const COLUMNS: TripColumn[] = [
  {
    header: "Booking Id",
    key: "bookingId",
    width: 28,
    pick: (booking) => String(booking._id),
  },
  {
    header: "Rider",
    key: "rider",
    width: 24,
    pick: (booking) => displayName(booking.userId),
  },
  {
    header: "Driver",
    key: "driver",
    width: 24,
    pick: (booking) => displayName(booking.driverId),
  },
  {
    header: "Mobility",
    key: "mobility",
    width: 18,
    pick: (booking) => booking.mobilityRequirements?.name ?? "",
  },
  {
    header: "Funding Source",
    key: "payerSource",
    width: 20,
    pick: (booking) => fundingSource(booking)?.name ?? "",
  },
  {
    header: "Funding Source Type",
    key: "payerType",
    width: 18,
    pick: (booking) => fundingSource(booking)?.type ?? "",
  },
  {
    header: "Pickup",
    key: "pickupLocation",
    width: 22,
    pick: (booking) => joinList(booking.pickupLocation),
  },
  {
    header: "Drop Off",
    key: "dropOffLocation",
    width: 22,
    pick: (booking) => joinList(booking.dropOffLocation),
  },
  {
    header: "Stop",
    key: "stopAddress",
    width: 22,
    pick: (booking) => joinList(booking.stopAddress),
  },
  {
    header: "Trip Type",
    key: "tripType",
    width: 14,
    pick: (booking) => text(booking.tripType),
  },
  {
    header: "Trip Reason",
    key: "tripReason",
    width: 18,
    pick: (booking) => text(booking.tripReason),
  },
  {
    header: "Program",
    key: "programContext",
    width: 20,
    pick: (booking) => text(booking.programContext),
  },
  {
    header: "Trip Note",
    key: "tripNote",
    width: 28,
    pick: (booking) => text(booking.tripNote),
  },
  {
    header: "Internal Note",
    key: "internalPrivateNote",
    width: 24,
    hiddenFrom: USER_ROLES.USER,
    pick: (booking) => text(booking.internalPrivateNote),
  },
  {
    header: "Passenger Seats",
    key: "passengerSeats",
    width: 16,
    pick: (booking) => text(booking.passengerSeats),
  },
  {
    header: "Service Date",
    key: "serviceDate",
    width: 16,
    pick: (booking) => text(booking.serviceDate),
  },
  {
    header: "Appointment Time",
    key: "appointmentTime",
    width: 18,
    pick: (booking) => text(booking.appointmentTime),
  },
  {
    header: "Pickup Time",
    key: "pickupTime",
    width: 14,
    pick: (booking) => text(booking.pickupTime),
  },
  {
    header: "Return Time",
    key: "returnTime",
    width: 14,
    pick: (booking) => text(booking.returnTime),
  },
  {
    header: "Driver Arrived At",
    key: "driverArrivedAt",
    width: 22,
    pick: (booking) => text(booking.driverArrivedAt),
  },
  {
    header: "Driver Pickup At",
    key: "driverPicupAt",
    width: 22,
    pick: (booking) => text(booking.driverPicupAt),
  },
  {
    header: "Recurring",
    key: "recurringBooking",
    width: 12,
    pick: (booking) => (booking.recurringBooking ? "yes" : "no"),
  },
  {
    header: "Selected Dates",
    key: "selectedDate",
    width: 28,
    pick: (booking) => dayList(booking.selectedDate),
  },
  {
    header: "End Date",
    key: "endDate",
    width: 16,
    pick: (booking) => text(booking.endDate),
  },
  {
    header: "Recurring Batch",
    key: "recurringBatchId",
    width: 28,
    pick: (booking) => text(booking.recurringBatchId),
  },
  {
    header: "Booking Status",
    key: "bookingStatus",
    width: 16,
    pick: (booking) => text(booking.bookingStatus),
  },
  {
    header: "Price",
    key: "price",
    width: 12,
    pick: (booking) => text(booking.price),
  },
  {
    header: "Passenger Copay",
    key: "passengerCoPay",
    width: 16,
    pick: (booking) => text(booking.passengerCoPay),
  },
  {
    header: "Funding Source Charge",
    key: "organizationContribution",
    width: 24,
    hiddenFrom: USER_ROLES.USER,
    pick: (booking) => text(booking.organizationContribution),
  },
  {
    header: "Total Price",
    key: "totalPrice",
    width: 12,
    hiddenFrom: USER_ROLES.USER,
    pick: (booking) => text(booking.totalPrice),
  },
  {
    header: "Approval",
    key: "isApproved",
    width: 14,
    pick: (booking) => text(booking.isApproved),
  },
  {
    header: "Payment Status",
    key: "paymentStatus",
    width: 16,
    pick: (booking) => text(booking.paymentStatus),
  },
  {
    header: "Straight Line Mileage",
    key: "straightLineMileage",
    width: 18,
    pick: (booking) => text(booking.straightLineMileage),
  },
  {
    header: "Route Mileage",
    key: "calculatedRouteMileage",
    width: 16,
    pick: (booking) => text(booking.calculatedRouteMileage),
  },
  {
    header: "GPS Mileage",
    key: "actualGpsMileage",
    width: 14,
    pick: (booking) => text(booking.actualGpsMileage),
  },
  {
    header: "Billing Mileage",
    key: "billingMileage",
    width: 16,
    pick: (booking) => text(booking.billingMileage),
  },
  {
    header: "Billing Source",
    key: "billingMileageSource",
    width: 16,
    pick: (booking) => text(booking.billingMileageSource),
  },
  {
    header: "Cancellation",
    key: "cancellationOutcome",
    width: 16,
    pick: (booking) => text(booking.cancellationOutcome),
  },
  {
    header: "No Show",
    key: "noShowOutcome",
    width: 14,
    pick: (booking) => text(booking.noShowOutcome),
  },
  {
    header: "Created At",
    key: "createdAt",
    width: 24,
    pick: (booking) => localIso(booking.createdAt),
  },
];

const columnsFor = (role?: string) =>
  COLUMNS.filter((column) => column.hiddenFrom !== role);

export const tripHistoryTable = (
  bookings: TripHistoryBooking[],
  role?: string,
) => {
  const columns = columnsFor(role);
  return {
    sheetName: "Trip History",
    filename: "trip-history",
    columns: columns.map(({ header, key, width }) => ({ header, key, width })),
    rows: bookings.map((booking) =>
      Object.fromEntries(
        columns.map((column) => [column.key, column.pick(booking)]),
      ),
    ),
  };
};
