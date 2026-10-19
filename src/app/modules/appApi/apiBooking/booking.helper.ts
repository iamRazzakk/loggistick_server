const WEEKDAY_MINUTES = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i;

/**
 * PREVIOUS IMPLEMENTATION
 * Only accepted "h:mm AM/PM". "14:30" returned null, so a valid 24-hour
 * pickup could not be compared with the appointment.
 *
 * NEW IMPLEMENTATION
 * One parser for booking validation and the driver "current trip" sort.
 * Accepts "h:mm AM/PM" and "HH:mm". Returns minutes from midnight, or null.
 */

const clockToMinutes = (time: string) => {
  if (typeof time !== "string") return null;
  const match = time.trim().match(WEEKDAY_MINUTES);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const suffix = match[4]?.toUpperCase();
  if (minutes > 59 || hours > (suffix ? 12 : 23)) return null;
  if (suffix) {
    hours = hours % 12;
    if (suffix === "PM") hours += 12;
  }
  return hours * 60 + minutes;
};
export const pickupAppointmentError = (
  pickupTime: string,
  appointmentTime: string,
) => {
  const pickup = clockToMinutes(pickupTime);
  const appointment = clockToMinutes(appointmentTime);
  if (pickup == null || appointment == null) {
    return "Pickup time and appointment time must be HH:mm or h:mm AM/PM";
  }
  if (pickup >= appointment) {
    return "Pickup time must be before the appointment time";
  }
  return null;
};
export default clockToMinutes;
