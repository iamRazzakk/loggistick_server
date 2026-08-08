import redisClient from "../config/redis.config";

interface IParams {
  key: string;
  value: number | string;
  expiration: number;
}

const post = async (params: IParams) => {
  await redisClient.set(params.key, params.value, "EX", params.expiration);
};

const get = async (key: string) => {
  const value = await redisClient.get(key);
  return value;
};

const del = async (key: string) => {
  await redisClient.del(key);
};

const expire = async (key: string, expiration: number) => {
  await redisClient.expire(key, expiration);
};

export const redisService = {
  post,
  get,
  del,
  expire,
};
