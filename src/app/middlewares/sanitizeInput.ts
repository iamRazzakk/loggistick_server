import { NextFunction, Request, Response } from "express";
import { FilterXSS, getDefaultWhiteList } from "xss";

/**
 * Removes injected scripts from text input (stored XSS).
 *
 * Only strings that look like HTML or a script URL are touched, so normal
 * text stays exactly as sent. Safe formatting (CMS rich text: p, b, ul, a…)
 * is kept; <script>, <iframe>, <svg>, event handlers (onerror=…),
 * javascript: links and other unknown tags/attributes are removed.
 */
const HTML_LIKE = /<\s*[a-z!/?]/i;
const SCRIPT_URL = /^\s*(?:javascript|vbscript|data\s*:\s*text\/html)\s*:?/i;
const SAFE_URL = /^(?:https?:|mailto:|tel:|\/(?!\/)|#)/i;

// Values that must never be modified (secrets / tokens / passwords).
const SKIP_KEYS = new Set([
  "password",
  "currentPassword",
  "newPassword",
  "confirmPassword",
  "token",
  "fcmToken",
  "deviceToken",
  "refreshToken",
  "accessToken",
]);

// Formatting tags only; no attributes except safe links and class.
const FORMATTING_TAGS = [
  "p", "br", "hr", "div", "span", "b", "strong", "i", "em", "u", "s", "del",
  "ins", "sub", "sup", "small", "mark", "blockquote", "code", "pre",
  "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
];
const defaults = getDefaultWhiteList();
const whiteList: Record<string, string[]> = { a: ["href", "title", "target", "rel"] };
for (const tag of FORMATTING_TAGS) {
  if (tag in defaults || ["div", "span"].includes(tag)) whiteList[tag] = ["class"];
}

const filter = new FilterXSS({
  whiteList,
  stripIgnoreTag: true, // unknown tags are removed (not shown as text)
  stripIgnoreTagBody: [
    "script", "style", "iframe", "object", "embed", "noscript",
    "textarea", "template", "svg", "math",
  ], // removed together with their content
  allowCommentTag: false,
  css: false,
  safeAttrValue: (tag, name, value) => {
    if (tag === "a" && name === "href") {
      const url = value.trim();
      return SAFE_URL.test(url) ? url.replace(/"/g, "&quot;") : "";
    }
    if (tag === "a" && name === "target") {
      return value === "_blank" ? value : "";
    }
    return value.replace(/[<>"]/g, "");
  },
});

export const cleanString = (value: string): string => {
  if (SCRIPT_URL.test(value)) return "";
  if (!HTML_LIKE.test(value)) return value;
  return filter.process(value);
};

const MAX_DEPTH = 20;

export const stripDangerousHtml = <T>(value: T, depth = 0): T => {
  if (depth > MAX_DEPTH) return value;
  if (typeof value === "string") return cleanString(value) as T;
  if (Array.isArray(value)) {
    return value.map((item) => stripDangerousHtml(item, depth + 1)) as T;
  }
  if (
    !value ||
    typeof value !== "object" ||
    Buffer.isBuffer(value) ||
    value instanceof Date
  ) {
    return value;
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (SKIP_KEYS.has(key)) continue;
    obj[key] = stripDangerousHtml(obj[key], depth + 1);
  }
  return value;
};
// 

const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    req.body = stripDangerousHtml(req.body);
  }
  if (req.query) stripDangerousHtml(req.query);
  next();
};

export default sanitizeInput;
