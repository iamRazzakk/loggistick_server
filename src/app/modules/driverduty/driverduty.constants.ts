export const DUTY_DATE_FORMAT = "yyyy-MM-dd";

export const DRIVER_POPULATE_FIELDS =
  "firstName lastName middleName email contact profile isOnDuty";

export const DRIVER_DUTY_QUEUE = "driver-duty";
export const FLUSH_DRIVER_DUTY_JOB = "flush-driver-duty";
export const DRIVER_DUTY_FLUSH_DELAY_MS = 2 * 60 * 1000;
export const DRIVER_DUTY_CACHE_TTL = 36 * 60 * 60;

export const DUTY_DIRTY_SET = "driverDuty:dirty";

export const dutyCacheKey = (driverId: string) => `driverDuty:${driverId}`;
export const dutyLockKey = (driverId: string) => `driverDuty:lock:${driverId}`;
