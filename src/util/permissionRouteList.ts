export const DISPATCHER_FRONTEND_ROUTES = [
  "/dashboard",
  "/operations",
  "/bookings",
  "/live",
  "/drivers",
  "/riders",
  "/applications",
  "/reports",
  "/trips",
  "/schedule",
  "/coverage",
  "/fleet",
  "/fleet/:id",
  "/notifications",
  "/settings",
  "/profile",
  "/finance",
  "/transactions",
  "/staff",
  "/cms",
  "/support",
  "/push",
] as const;

export type DispatcherFrontendRoute =
  (typeof DISPATCHER_FRONTEND_ROUTES)[number];

const DISPATCHER_FRONTEND_ROUTE_SET = new Set<string>(
  DISPATCHER_FRONTEND_ROUTES,
);

export const findInvalidDispatcherRoutes = (routes: string[]): string[] => {
  return [...new Set(routes)].filter(
    (route) => !DISPATCHER_FRONTEND_ROUTE_SET.has(route),
  );
};
