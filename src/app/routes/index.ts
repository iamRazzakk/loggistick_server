import express from "express";
import { UserRoutes } from "../modules/user/user.routes";
import { AuthRoutes } from "../modules/auth/auth.routes";
import { VehicleRoutes } from "../modules/vehicle/vehicle.route";
import { FundingSourcesRoutes } from "../modules/funding_sources/funding_sources.route";
import { FacilitiesAndProgramsRoutes } from "../modules/facilities_and_programs/facilities_and_programs.route";
import { CompanySupportRoutes } from "../modules/company_support/company_support.route";
import { BookingRoutes } from "../modules/booking/booking.route";
import { ReportsRoutes } from "../modules/reports/reports.route";
import { ApplicationsRoutes } from "../modules/applications/applications.route";
import { RuleRoutes } from "../modules/rule/rule.route";
import { FaqRoutes } from "../modules/faq/faq.route";
import { PushNotificationRoutes } from "../modules/push_notification/push_notification.route";
import { CountiesRoutes } from "../modules/serviceAndTariff/counties/counties.routes";
import { MobilityRoutes } from "../modules/serviceAndTariff/mobility/mobility.route";
import { PayersRoutes } from "../modules/serviceAndTariff/payers/payers.route";
import { UserManagementRoutes } from "../modules/user-management/user-management.route";
import { DashboardRoutes } from "../modules/dashboard/dashboard.route";
import { ScheduledRoutes } from "../modules/scheduled/scheduled.route";
import { VehicleAssignRoutes } from "../modules/vehicleassign/vehicleassign.route";
import { DriverratingRoutes } from "../modules/driverrating/driverrating.route";
import { AppApiBookingRoutes } from "../modules/appApi/apiBooking/booking.routes";
import { ChatRoutes } from "../modules/chat/chat.routes";
import { MessageRoutes } from "../modules/message/message.routes";
import { BankcardRoutes } from "../modules/bankcard/bankcard.route";
import { NotificationRoutes } from "../modules/notification/notification.routes";
import { EmergencyContactRoutes } from "../modules/emergency_contact/emergency_contact.route";
import { PaymentRoutes } from "../modules/payment/payment.route";
import { BroadcastNotificationRoutes } from "../modules/broadcast_notification/broadcast.route";

const router = express.Router();

const apiRoutes = [
  { path: "/user", route: UserRoutes },
  { path: "/auth", route: AuthRoutes },
  { path: "/vehicle", route: VehicleRoutes },
  { path: "/funding-sources", route: FundingSourcesRoutes },
  { path: "/facilities-and-programs", route: FacilitiesAndProgramsRoutes },
  { path: "/company-support", route: CompanySupportRoutes },
  { path: "/booking", route: BookingRoutes },
  { path: "/reports", route: ReportsRoutes },
  { path: "/applications", route: ApplicationsRoutes },
  { path: "/rule", route: RuleRoutes },
  { path: "/faq", route: FaqRoutes },
  { path: "/push-notification", route: PushNotificationRoutes },
  { path: "/notification", route: NotificationRoutes },
  { path: "/notifications", route: BroadcastNotificationRoutes },
  { path: "/counties", route: CountiesRoutes },
  { path: "/mobility", route: MobilityRoutes },
  { path: "/payers", route: PayersRoutes },
  { path: "/user-management", route: UserManagementRoutes },
  { path: "/dashboard", route: DashboardRoutes },
  { path: "/bookings", route: ScheduledRoutes },
  { path: "/vehicle-assign", route: VehicleAssignRoutes },
  { path: "/ratings", route: DriverratingRoutes },
  { path: "/my-ongoing-bookings", route: AppApiBookingRoutes },
  { path: "/chat", route: ChatRoutes },
  { path: "/message", route: MessageRoutes },
  { path: "/bankcard", route: BankcardRoutes },
  { path: "/emergency-contact", route: EmergencyContactRoutes },
  { path: "/payment", route: PaymentRoutes },
];

apiRoutes.forEach((route) => router.use(route.path, route.route));
export default router;
