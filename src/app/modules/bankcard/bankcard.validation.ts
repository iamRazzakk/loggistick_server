import { z } from "zod";
import { Types } from "mongoose";
const bankCardZodSchema = z.object({
  userId: z.string().refine((id) => Types.ObjectId.isValid(id), {
    message: "Invalid user ID",
  }),
  cardNumber: z.string().refine((cardNumber) => cardNumber.length === 16, {
    message: "Invalid card number",
  }),
  cardExpirationDate: z.string().refine(
    (cardExpirationDate) => {
      const [month, year] = cardExpirationDate.split("/");
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.getTime() > Date.now();
    },
    {
      message: "Invalid card expiration date",
    },
  ),
  cardCvv: z.string().refine((cardCvv) => cardCvv.length === 3, {
    message: "Invalid card CVV",
  }),
  cardHolderName: z.string().min(1, {
    message: "Invalid card holder name",
  }),
  zipCode: z.number().refine((zipCode) => zipCode.toString().length === 5, {
    message: "Invalid zip code",
  }),
});

const createBankCardZodSchema = bankCardZodSchema.omit({ userId: true });

const updateBankCardZodSchema = bankCardZodSchema.partial();


export const BankcardValidations = {
  createBankCardZodSchema,
  updateBankCardZodSchema,
};
