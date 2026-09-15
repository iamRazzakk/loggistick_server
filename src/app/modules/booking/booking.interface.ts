import { Model } from "mongoose";
import { Types } from "mongoose";
export enum AppointmentType {
  MEDICAL_APPOINTMENT = "Medical Appointment",
  DIALYSIS = "Dialysis",
  CHEMOTHERAPY = "Chemotherapy",
  PHYSICAL_THERAPY = "Physical Therapy",
  HOSPITAL_DISCHARGE = "Hospital Discharge",
  SPECIALIST_VISIT = "Specialist Visit",
  ROUTINE_CHECKUP = "Routine Checkup",
  EYE_EXAM = "Eye Exam",
  DENTAL = "Dental",
  PERSONAL = "Personal",
}
export enum County {
  CHESTERFIELD = "Chesterfield County",
  HENRICO = "Henrico County",
  HANOVER = "Hanover County",
  RICHMOND_CITY = "Richmond City",
  GOOCHLAND = "Goochland County",
  POWHATAN = "Powhatan County",
}

export type IBooking = {
  // user data
  userId: Types.ObjectId;
  // pickup and drop
  pickupLocation: number;
  dropOffLocation: number;
  stopAddress?: number;
  // mobility requirements
  mobilityRequirements: Types.ObjectId;
  // note
  tripNote?: string;
  internalPrivateNote?: string;

  // trip configuration
  tripType: "one-way" | "round-trip";
  tripReason: AppointmentType;
  // passenger seats
  passengerSeats: number;

  // County source
  payerSource: Types.ObjectId;
  programContext: string;

  // service
  serviceDate: string;
  appointmentTime: string;
  pickupTime: string;
  // if round-trip
  returnTime?: string;
  recurringBooking: boolean;
  selectedDate?:
    | "saturday"
    | "sunday"
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | string[];

  endDate?: string;
  // driver
  driverId: Types.ObjectId;
  // booking status
  bookingStatus:
    | "pending"
    | "assigned"
    | "in-progress"
    | "confirmed"
    | "cancelled"
    | "completed";
  recurringBatchId?: string;
  price?: number;
};

export type BookingModel = Model<IBooking>;
