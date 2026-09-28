import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const identityFilePath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", ".data", "worker.json");

await rm(identityFilePath, { force: true });
console.log(`Worker identity reset: ${identityFilePath}`);