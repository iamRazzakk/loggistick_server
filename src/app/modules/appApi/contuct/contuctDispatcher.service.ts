import { USER_ROLES } from "../../../../enums/user";
import { User } from "../../user/user.model";

const contuctDispatcher = async () => {
  const result = await User.find({ role: USER_ROLES.SUPER_ADMIN })
    .select("email contact")
    .lean();
  return result;
};

export const ContuctDispatcherService = {
  contuctDispatcher,
};
