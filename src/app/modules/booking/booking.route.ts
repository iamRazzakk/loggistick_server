import express from "express";
import { BookingController } from "./booking.controller";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";
import validateRequest from "../../middlewares/validateRequest";
import { BookingValidations } from "./booking.validation";

const router = express.Router();

router
  .route("/")
  // create booking API
  .post(
    auth(USER_ROLES.DISPATCHER, USER_ROLES.SUPER_ADMIN, USER_ROLES.USER),
    validateRequest(BookingValidations.createBookingZodSchema),
    BookingController.createBooking,
  )
  // all pending bookings API
  .get(
    auth(
      // USER_ROLES.DISPATCHER,
      // USER_ROLES.DRIVER,
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
    BookingController.getAllMyBookings,
  );

// trip history API
router
  .route("/history")
  .get(
    auth(
      USER_ROLES.DISPATCHER,
      USER_ROLES.DRIVER,
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.USER,
    ),
    BookingController.getTripHistory,
  );

// scheduled bookings
router
  .route("/scheduled")
  .get(
    auth(USER_ROLES.DISPATCHER, USER_ROLES.DRIVER, USER_ROLES.SUPER_ADMIN),
    BookingController.getScheduledBookings,
  );
// calculate total trip price
router
  .route("/calculate-price")
  .post(BookingController.calculateTotalTripPrice);
router
  .route("/:id")
  .get(
    auth(
      USER_ROLES.DISPATCHER,
      USER_ROLES.DRIVER,
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.USER,
    ),
    BookingController.getBookingById,
  )
  .patch(
    auth(
      USER_ROLES.DISPATCHER,
      USER_ROLES.DRIVER,
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.USER,
    ),
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
