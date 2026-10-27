#!/usr/bin/env node
"use strict";

/**
 * Blocks AI reads of secret env files.
 * .env.example stays readable. Application config stays readable.
 *
 * Used by beforeReadFile, beforeTabFileRead, beforeShellExecution, and preToolUse.
 * Never print file contents. Stdin may contain them.
 */

const PATH_KEYS = new Set([
  "file_path",
  "path",
  "target_file",
  "file",
  "glob",
  "target_directory",
]);

function normalize(value) {
  return String(value).replace(/\\/g, "/");
}

function baseName(value) {
  const norm = normalize(value).replace(/\/+$/, "");
  const slash = norm.lastIndexOf("/");
  return (slash === -1 ? norm : norm.slice(slash + 1)).toLowerCase();
}

function isProtectedPath(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  const norm = normalize(value);

  const base = baseName(norm);
  if (base === ".env.example") return false;
  if (base === ".env" || base.startsWith(".env.")) return true;
  return false;
}

function globHitsProtected(value) {
  if (typeof value !== "string") return false;
  const norm = normalize(value).toLowerCase();
  if (isProtectedPath(norm)) return true;
  if (/(^|\/)\.env\*$/.test(norm)) return true;
  if (/(^|\/)\.env\.\*(?!\.example)/.test(norm)) return true;
  return false;
}

function commandHitsProtected(command) {
  const text = normalize(command);

  const re = /(^|[\s"'`=:(])([^\s"'`;|&<>]*\.env(?:\.[^\s"'`;|&<>]*)?)/gi;
  let match;
  while ((match = re.exec(text))) {
    const token = match[2].replace(/[),]+$/g, "");
    if (isProtectedPath(token)) return token;
  }
  return null;
}

function collectProtectedInputs(value, hits) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectProtectedInputs(item, hits);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string" && PATH_KEYS.has(key)) {
      if (isProtectedPath(child) || globHitsProtected(child)) hits.push(child);
    } else if (child && typeof child === "object") {
      collectProtectedInputs(child, hits);
    }
  }
}

function writeJson(payload) {
  process.stdout.write(JSON.stringify(payload));
}

function deny(event) {
  const userMessage =
    "Blocked. AI cannot read .env (or other secret .env.* files). .env.example is allowed.";
  const agentMessage =
    "This read was blocked by a project hook. Do not retry .env via Read, Grep, or the shell. Use .env.example for variable names.";

  if (event === "beforeTabFileRead") {
    writeJson({ permission: "deny" });
    return;
  }
  if (event === "beforeReadFile") {
    writeJson({ permission: "deny", user_message: userMessage });
    return;
  }
  writeJson({
    permission: "deny",
    user_message: userMessage,
    agent_message: agentMessage,
  });
}

function allow(event) {
  if (event === "beforeReadFile" || event === "beforeTabFileRead") {
    writeJson({ permission: "allow" });
    return;
  }
  writeJson({ permission: "allow" });
}

function decide(input) {
  const event =
    input.hook_event_name ||
    (input.tool_name ? "preToolUse" : null) ||
    (typeof input.command === "string" ? "beforeShellExecution" : null) ||
    (input.file_path ? "beforeReadFile" : "beforeReadFile");

  if (event === "beforeShellExecution") {
    const hit = commandHitsProtected(input.command || "");
    if (hit) {
      deny(event);
      return;
    }
    allow(event);
    return;
  }

  if (event === "preToolUse") {
    const hits = [];
    collectProtectedInputs(input.tool_input, hits);
    if (typeof input.tool_input === "string") {
      const shellHit = commandHitsProtected(input.tool_input);
      if (shellHit) hits.push(shellHit);
    }
    if (hits.length > 0) {
      deny(event);
      return;
    }
    allow(event);
    return;
  }

  const paths = [];
  if (typeof input.file_path === "string") paths.push(input.file_path);
  if (Array.isArray(input.attachments)) {
    for (const attachment of input.attachments) {
      if (attachment && typeof attachment.file_path === "string") {
        paths.push(attachment.file_path);
      }
    }
  }
  if (paths.some((filePath) => isProtectedPath(filePath))) {
    deny(event);
    return;
  }
  allow(event);
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  if (!raw.trim()) {
    process.exit(2);
  }
  try {
    decide(JSON.parse(raw));
  } catch {
    process.exit(2);
  }
});
