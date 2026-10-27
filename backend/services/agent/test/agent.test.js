// Agent service tests — rate limits, upload validation, error middleware
// Run: node --experimental-vm-modules --test test/agent.test.js

import assert from "node:assert/strict"
import { test, mock, before, after } from "node:test"
import { writeFile, rm, mkdir } from "node:fs/promises"
import path from "node:path"
import os from "node:os"

process.env.NODE_ENV = "test"
process.env.PORT = process.env.PORT || "8003"
process.env.INTERNAL_SECRET_KEY = "test-secret"
if (!process.env.REDIS_URL) {
    process.env.REDIS_URL = "redis://127.0.0.1:6379"
}

const { default: redis } = await import("../../../shared/redis/redis.js")
const { checkAgentLimit } = await import("../config/agentLimit.js")
const { verifyFileMagicBytes } = await import("../config/multer.js")

after(async () => {
    try {
        redis.disconnect()
    } catch (e) {}
})

// ─── 1. checkAgentLimit ───────────────────────────────────────────────────────

test("checkAgentLimit — allows requests under the limit", async () => {
    mock.method(redis, "incr", async () => 1)
    mock.method(redis, "expire", async () => 1)
    mock.method(redis, "ttl", async () => 60)

    const result = await checkAgentLimit("user-1", "chat")

    assert.equal(result.limit, 20)
    assert.equal(result.remaining, 19)
})

test("checkAgentLimit — throws 429 when request count exceeds limit", async () => {
    mock.method(redis, "incr", async () => 21) // over chat limit (20)
    mock.method(redis, "expire", async () => 1)
    mock.method(redis, "ttl", async () => 45)

    await assert.rejects(
        () => checkAgentLimit("user-1", "chat"),
        (err) => {
            assert.equal(err.status, 429)
            assert.equal(err.data.agent, "chat")
            assert.equal(err.data.limit, 20)
            assert.ok(err.data.retryAfter)
            assert.match(err.data.message, /chat limit/i)
            return true
        }
    )
})

test("checkAgentLimit — debug agent uses its own limit (not chat's)", async () => {
    mock.method(redis, "incr", async () => 1)
    mock.method(redis, "expire", async () => 1)
    mock.method(redis, "ttl", async () => 60)

    const result = await checkAgentLimit("user-1", "debug")
    assert.equal(result.limit, 5) // debug limit is 5
})

test("checkAgentLimit — vision agent uses its own limit (not chat's)", async () => {
    mock.method(redis, "incr", async () => 1)
    mock.method(redis, "expire", async () => 1)
    mock.method(redis, "ttl", async () => 60)

    const result = await checkAgentLimit("user-1", "vision")
    assert.equal(result.limit, 3) // vision limit is 3
})

// ─── 2. verifyFileMagicBytes ──────────────────────────────────────────────────

let tmpDir

before(async () => {
    tmpDir = path.join(os.tmpdir(), `cortex-test-${Date.now()}`)
    await mkdir(tmpDir, { recursive: true })
})

after(async () => {
    if (tmpDir) {
        await rm(tmpDir, { recursive: true, force: true })
    }
})

test("verifyFileMagicBytes — accepts a real PDF file", async () => {
    const filePath = path.join(tmpDir, "real.pdf")
    await writeFile(filePath, Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]))

    await assert.doesNotReject(() => verifyFileMagicBytes(filePath, ["pdf"]))
})

test("verifyFileMagicBytes — accepts a real PNG file", async () => {
    const filePath = path.join(tmpDir, "real.png")
    await writeFile(filePath, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]))

    await assert.doesNotReject(() => verifyFileMagicBytes(filePath, ["image"]))
})

test("verifyFileMagicBytes — rejects a file that claims to be PDF but isn't", async () => {
    const filePath = path.join(tmpDir, "fake.pdf")
    await writeFile(filePath, Buffer.from("<!DOCTYPE html><html>"))

    await assert.rejects(
        () => verifyFileMagicBytes(filePath, ["pdf"]),
        (err) => {
            assert.equal(err.status, 415)
            return true
        }
    )
})

test("verifyFileMagicBytes — rejects a PDF when only image is allowed", async () => {
    const filePath = path.join(tmpDir, "pdf-as-image.pdf")
    await writeFile(filePath, Buffer.from([0x25, 0x50, 0x44, 0x46]))

    await assert.rejects(
        () => verifyFileMagicBytes(filePath, ["image"]),
        (err) => {
            assert.equal(err.status, 415)
            return true
        }
    )
})

// ─── 3. Express error middleware pattern test ─────────────────────────────────

const agentErrorHandler = (err, req, res, next) => {
    const status = Number.isInteger(err.status) ? err.status : 500
    if (err.data) {
        return res.status(status).json(err.data)
    }
    return res.status(status).json({
        success: false,
        message: err.message || "An unexpected agent error occurred.",
    })
}

test("error middleware — forwards 429 rate-limit data as-is", async () => {
    const express = (await import("express")).default
    const app = express()

    app.get("/test", (_req, _res, next) => {
        const err = new Error("Rate limited")
        err.status = 429
        err.data = { success: false, message: "Slow down", retryAfter: "30s" }
        next(err)
    })
    app.use(agentErrorHandler)

    const server = app.listen(0)
    await new Promise((res, rej) => { server.once("listening", res); server.once("error", rej) })
    const port = server.address().port

    try {
        const response = await fetch(`http://127.0.0.1:${port}/test`)
        const body = await response.json()

        assert.equal(response.status, 429)
        assert.equal(body.message, "Slow down")
        assert.equal(body.retryAfter, "30s")
    } finally {
        await new Promise((res) => server.close(res))
    }
})

test("error middleware — returns 500 with clean message for unknown errors", async () => {
    const express = (await import("express")).default
    const app = express()

    app.get("/test", (_req, _res, next) => {
        next(new Error("Something internal broke"))
    })
    app.use(agentErrorHandler)

    const server = app.listen(0)
    await new Promise((res, rej) => { server.once("listening", res); server.once("error", rej) })
    const port = server.address().port

    try {
        const response = await fetch(`http://127.0.0.1:${port}/test`)
        const body = await response.json()

        assert.equal(response.status, 500)
        assert.equal(body.success, false)
        assert.equal(body.message, "Something internal broke")
    } finally {
        await new Promise((res) => server.close(res))
    }
})
