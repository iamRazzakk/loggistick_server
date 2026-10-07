import { User } from "../app/modules/user/user.model";

const dispatcherRouteCache = new Map<string, Set<string>>();

export const setDispatcherRoutes = (
  userId: string,
  routes: string[] | undefined,
): void => {
  dispatcherRouteCache.set(userId, new Set(routes ?? []));
};

export const getDispatcherAllowedSet = async (
  userId: string,
): Promise<Set<string>> => {
  const cached = dispatcherRouteCache.get(userId);
  if (cached) {
    return cached;
  }

  const user = await User.findById(userId).select("accessScope").lean();
  const allowed = new Set(user?.accessScope ?? []);
  dispatcherRouteCache.set(userId, allowed);
  return allowed;
};
