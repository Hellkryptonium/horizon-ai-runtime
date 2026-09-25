import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  loadWorkerId,
  resolveWorkerIdentity,
  saveWorkerId,
} from "./identity.js";

const createIdentityPath = async () => {
  const directory = await mkdtemp(join(tmpdir(), "horizon-worker-"));
  return {
    directory,
    path: join(directory, "worker.json"),
  };
};

test("worker identity persists across restarts", async () => {
  const identity = await createIdentityPath();

  try {
    await saveWorkerId(identity.path, "worker-one");
    assert.equal(await loadWorkerId(identity.path), "worker-one");
    assert.equal(await readFile(identity.path, "utf8"), '{\n  "workerId": "worker-one"\n}\n');
  } finally {
    await rm(identity.directory, { recursive: true, force: true });
  }
});

test("existing worker ID reconnects without creating a duplicate", async () => {
  const identity = await createIdentityPath();
  let registerCalls = 0;
  let reconnectCalls = 0;

  try {
    await saveWorkerId(identity.path, "existing-worker");
    const result = await resolveWorkerIdentity({
      identityFilePath: identity.path,
      register: async () => {
        registerCalls += 1;
        return "new-worker";
      },
      reconnect: async (workerId) => {
        reconnectCalls += 1;
        assert.equal(workerId, "existing-worker");
      },
      isWorkerNotFound: () => false,
    });

    assert.deepEqual(result, { workerId: "existing-worker", reconnected: true });
    assert.equal(registerCalls, 0);
    assert.equal(reconnectCalls, 1);
  } finally {
    await rm(identity.directory, { recursive: true, force: true });
  }
});

test("missing worker identity is replaced after re-registration", async () => {
  const identity = await createIdentityPath();
  let registerCalls = 0;

  try {
    await saveWorkerId(identity.path, "deleted-worker");
    const result = await resolveWorkerIdentity({
      identityFilePath: identity.path,
      register: async () => {
        registerCalls += 1;
        return "replacement-worker";
      },
      reconnect: async () => {
        throw new Error("worker not found");
      },
      isWorkerNotFound: (error) => error instanceof Error && error.message === "worker not found",
    });

    assert.deepEqual(result, { workerId: "replacement-worker", reconnected: false });
    assert.equal(registerCalls, 1);
    assert.equal(await loadWorkerId(identity.path), "replacement-worker");
  } finally {
    await rm(identity.directory, { recursive: true, force: true });
  }
});
