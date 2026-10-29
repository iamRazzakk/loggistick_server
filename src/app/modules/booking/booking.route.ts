import express from "express";
import { BookingController } from "./booking.controller";
import auth from "../../middlewares/auth";
import checkDispatcherRoute from "../../middlewares/checkDispatcherRoute";
import { USER_ROLES } from "../../../enums/user";
import validateRequest from "../../middlewares/validateRequest";
import { BookingValidations } from "./booking.validation";

const router = express.Router();

router
  .route("/")
  // create booking API
  .post(
    auth(USER_ROLES.DISPATCHER, USER_ROLES.SUPER_ADMIN, USER_ROLES.USER),
    checkDispatcherRoute("/bookings"),
    validateRequest(BookingValidations.createBookingZodSchema),
    BookingController.createBooking,
  )
  // all pending bookings API
  .get(
    auth(
      // USER_ROLES.DISPATCHER,
      USER_ROLES.DRIVER,
      USER_ROLES.SUPER_ADMIN,
      // USER_ROLES.USER,
    ),
    BookingController.getAllBookings,
  );
// ready to assign bookings API
router
  .route("/approved")
  .get(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
    checkDispatcherRoute("/bookings"),
    BookingController.getAllApprovedBookings,
  );
// my bookings API
router
  .route("/my")
  .get(
    auth(
      USER_ROLES.DISPATCHER,
      USER_ROLES.DRIVER,
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.USER,
    ),
    checkDispatcherRoute("/bookings"),
    BookingController.getAllMyBookings,
  );

// Trip History page (Show Map + Export toolbar)
// Shared optional query for list, map, and file:
//   startDate, endDate = yyyy-MM-dd on booking.serviceDate
//   payerId | payerSource = Payers._id via County.payersId → booking.countyId
//   searchTerm, driverId, unassign, sort, page, limit
const tripHistoryAuth = [
  auth(
    USER_ROLES.DISPATCHER,
    USER_ROLES.DRIVER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.USER,
  ),
  checkDispatcherRoute("/trips"),
] as const;

// GET /api/v1/booking/history — table + map JSON
router
  .route("/history")
  .get(...tripHistoryAuth, BookingController.getTripHistory);

// GET /api/v1/booking/history/export?type=excel|csv|pdf — file download
// GET /api/v1/booking/history/excel — same handler (legacy path)
router
  .route("/history/export")
  .get(...tripHistoryAuth, BookingController.getTripHistoryInExcel);
router
  .route("/history/excel")
  .get(...tripHistoryAuth, BookingController.getTripHistoryInExcel);
// scheduled bookings
router
  .route("/scheduled")
  .get(
    auth(USER_ROLES.DISPATCHER, USER_ROLES.DRIVER, USER_ROLES.SUPER_ADMIN),
    checkDispatcherRoute("/schedule"),
    BookingController.getScheduledBookings,
  );
// calculate total trip price
router
  .route("/calculate-price")
  .post(
    auth(USER_ROLES.DISPATCHER, USER_ROLES.SUPER_ADMIN, USER_ROLES.USER),
    BookingController.calculateTotalTripPrice,
  );
router
  .route("/:id")
  .get(
    auth(
      USER_ROLES.DISPATCHER,
      USER_ROLES.DRIVER,
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.USER,
    ),
    checkDispatcherRoute("/bookings"),
    BookingController.getBookingById,
  )
  .patch(
    auth(
      USER_ROLES.DISPATCHER,
      USER_ROLES.DRIVER,
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.USER,
    ),
    checkDispatcherRoute("/bookings"),
    validateRequest(BookingValidations.updateBookingZodSchema),
    BookingController.updateBooking,
  );

// single rider booking history
router
  .route("/rider/:id")
  .get(
    auth(USER_ROLES.SUPER_ADMIN),
    BookingController.getSingleRiderBookingHistory,
  );

export const BookingRoutes = router;
