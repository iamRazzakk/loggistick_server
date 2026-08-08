import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import { IRule } from "./rule.interface";
import { Rule } from "./rule.model";
import { redisService } from "../../../redis/redis.service";

const createRuleToDB = async (rule: IRule) => {
  const existingRule = await Rule.findOne({ type: rule.type });
  if (existingRule) {
    await existingRule.updateOne(rule);
    return existingRule;
  }
  await redisService.del(`rule:${rule.type}`);
  return await Rule.create(rule);
};

const getRuleFromDB = async (type: "privacy" | "terms" | "about") => {
  if (!type) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Type is required");
  }
  //   need to use redis
  const data = await redisService.get(`rule:${type}`);
  if (data) {
    console.log("data from redis::::::");
    return JSON.parse(data);
  }
  const rule = await Rule.findOne({ type }).lean().select("-__v");
  await redisService.post({
    key: `rule:${type}`,
    value: JSON.stringify(rule),
    expiration: 60 * 60 * 24 * 30,
  });
  return rule;
};

export const RuleService = {
  createRuleToDB,
  getRuleFromDB,
};
