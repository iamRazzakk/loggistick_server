import http from "k6/http";
import { check } from "k6";

const rate = Number(__ENV.RATE);
const preAllocatedVUs = Math.max(200, rate * 2);
const maxVUs = Math.max(1000, rate * 10);

export const options = {
  scenarios: {
    bench: {
      executor: "constant-arrival-rate",
      rate,
      timeUnit: "1s",
      duration: __ENV.DURATION,
      preAllocatedVUs,
      maxVUs,
    },
  },
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

export default function () {
  const headers = {};
  if (__ENV.ACCEPT_ENCODING) {
    headers["Accept-Encoding"] = __ENV.ACCEPT_ENCODING;
  }
  if (__ENV.BEARER_TOKEN) {
    headers.Authorization = `Bearer ${__ENV.BEARER_TOKEN}`;
  }

  const res = http.get(__ENV.TARGET_URL, { headers });
  check(res, {
    "2xx non-empty body": (r) =>
      r.status >= 200 && r.status < 300 && r.body != null && r.body.length > 0,
  });
}
