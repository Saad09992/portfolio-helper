// Produce the APP_PASSWORD_HASH value for the Workers session gate.
//
//   node scripts/hash-password.mjs            # prompts, input hidden
//   echo -n 'pw' | node scripts/hash-password.mjs --stdin
//
// Then store the printed value as a secret:
//   wrangler secret put APP_PASSWORD_HASH
//
// The plaintext password is never written to disk, and never needs to be given
// to wrangler — only the derived hash is.

import { createInterface } from "readline";
import { hashPassword } from "../worker/auth.mjs";

async function readHidden(prompt) {
  process.stderr.write(prompt);
  const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  // Suppress echo so the password does not end up in the terminal scrollback.
  const originalWrite = rl._writeToOutput?.bind(rl);
  rl._writeToOutput = () => {};
  const answer = await new Promise((resolve) => rl.question("", resolve));
  rl._writeToOutput = originalWrite;
  rl.close();
  process.stderr.write("\n");
  return answer;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

const password = process.argv.includes("--stdin")
  ? await readStdin()
  : await readHidden("Password: ");

if (!password || password.length < 12) {
  console.error("[psx] refusing: use a password of at least 12 characters");
  process.exit(1);
}

process.stderr.write("[psx] deriving (PBKDF2-SHA256, 210k iterations)…\n");
process.stdout.write((await hashPassword(password)) + "\n");
