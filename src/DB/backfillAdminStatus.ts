import colors from "colors";
import { Booking } from "../app/modules/booking/booking.model";
import { logger } from "../shared/logger";

/**
 * Old bookings were created before `adminStatus` existed. Set it to
 * "completed" on every booking that does not have it yet. Safe to run on
 * every start: after the first run it matches nothing.
 * Uses the native collection because the schema marks the field immutable.
 */
const backfillAdminStatus = async () => {
  const result = await Booking.collection.updateMany(
    { adminStatus: { $exists: false } },
    { $set: { adminStatus: "completed" } },
  );
  if (result.modifiedCount) {
    logger.info(
      colors.green(
        `✔ adminStatus backfilled on ${result.modifiedCount} booking(s)`,
      ),
    );
  }
};

export default backfillAdminStatus;
