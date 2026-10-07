import { Router } from "express";
import { CountiesController } from "./counties.controller";
import { CountiesValidation } from "./counties.validation";
import validateRequest from "../../../middlewares/validateRequest";
import auth from "../../../middlewares/auth";
import checkDispatcherRoute from "../../../middlewares/checkDispatcherRoute";
import { USER_ROLES } from "../../../../enums/user";
import { getUploadFields } from "../../../middlewares/fileUploaderHandlar";
import { parseCountyUpload } from "./counties.parseCountyUpload.utils";

const router = Router();

router
  .route("/")
  .post(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
    checkDispatcherRoute("/coverage"),
    getUploadFields(),
    parseCountyUpload,
    validateRequest(CountiesValidation.createCountyZodSchema),
    CountiesController.createCounties,
  )
  .get(
    // auth(
    //   USER_ROLES.SUPER_ADMIN,
    //   USER_ROLES.USER,
    //   USER_ROLES.DISPATCHER,
    //   USER_ROLES.DRIVER,
    // ),
    CountiesController.getAllCounties,
  );

router
  .route("/admin/:id")
  .get(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
    checkDispatcherRoute("/coverage"),
    CountiesController.getAllCountiesAdmin,
  );

router
  .route("/check-location")
  .get(
    auth(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.USER,
      USER_ROLES.DISPATCHER,
      USER_ROLES.DRIVER,
    ),
    checkDispatcherRoute("/coverage"),
    CountiesController.checkLocation,
  );

router
  .route("/:id")
  .get(
    auth(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.USER,
      USER_ROLES.DISPATCHER,
      USER_ROLES.DRIVER,
    ),
    checkDispatcherRoute("/coverage"),
    CountiesController.getSingleCounty,
  )
  .patch(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
    checkDispatcherRoute("/coverage"),
    getUploadFields(),
    parseCountyUpload,
    validateRequest(CountiesValidation.updateCountyZodSchema),
    CountiesController.updateCounties,
  )
  .delete(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
    checkDispatcherRoute("/coverage"),
    CountiesController.deleteCounties,
  );

export const CountiesRoutes = router;
