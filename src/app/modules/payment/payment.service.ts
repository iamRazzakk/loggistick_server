import QueryBuilder from "../../builder/queryBuilder";
import { Payment } from "./payment.model";

const getAllPaymentsFromDB = async (query: Record<string, any>) => {
  const qb = new QueryBuilder(Payment.find(), query)
    .filter()
    .sort()
    .paginate()
    .populate(["userId"], {
      userId: "email firstName middleName lastName profile contact",
    });
  const [data, meta] = await Promise.all([
    qb.modelQuery.lean(),
    qb.getPaginationInfo(),
  ]);
  return { data, meta };
};

export const PaymentServices = {
  getAllPaymentsFromDB,
};
