import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { USER_ROLES } from "../../enums/user";
import { getDispatcherAllowedSet } from "../../helpers/dispatcherRouteCache";
import { DispatcherFrontendRoute } from "../../util/permissionRouteList";

const checkDispatcherRoute =
  (frontendRoute: DispatcherFrontendRoute) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || req.user.role !== USER_ROLES.DISPATCHER) {
        return next();
      }

      const allowedSet = await getDispatcherAllowedSet(String(req.user.id));

      const hasExactMatch = allowedSet.has(frontendRoute);
      const hasParentFleetMatch =
        frontendRoute === "/fleet/:id" && allowedSet.has("/fleet");

      if (!hasExactMatch && !hasParentFleetMatch) {
        return res.status(StatusCodes.FORBIDDEN).json({
          success: false,
          code: "DISPATCHER_ROUTE_DENIED",
          message: `Dispatcher access denied for route: ${frontendRoute}`,
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };

export default checkDispatcherRoute;
