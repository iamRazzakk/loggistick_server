export const DRIVER_DUTY_KEY = (driverId: string) => `driver:duty:${driverId}`;

export const DRIVER_LOC_KEY = (driverId: string) => `driver:loc:${driverId}`;

export const DRIVER_PERSIST_LOCK = (driverId: string) =>
  `driver:loc:persist:${driverId}`;

export const DRIVER_LOC_TTL_SEC = 30;
export const DRIVER_PERSIST_EVERY_SEC = 20;
export const DRIVER_DUTY_TTL_SEC = 60 * 60 * 12;

export type IDriverLocationPayload = {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  bookingId?: string;
};

export type IToggleDutyPayload = {
  isOnDuty: boolean;
  lat?: number;
  lng?: number;
  heading?: number;
  speed?: number;
};

export type IDriverLiveLocation = {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  updatedAt: number;
  bookingId?: string;
};

export type ILiveTracking = {
  isOnDuty: boolean;
  isStale: boolean;
  isFallback: boolean;
  isRedisAvailable: boolean;
  location: IDriverLiveLocation | null;
};
