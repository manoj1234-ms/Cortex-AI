// Auth service tests — uses Node's built-in test runner (node:test)
// Run: node --experimental-vm-modules --test test/auth.test.js
//
// What is tested:
//  1. updateUserPayment — plan whitelist, credit cap, missing user
//  2. deductCredits     — atomic check, insufficient credits, unknown user
//  3. internalOnly      — missing/wrong/correct secret header
//  4. login             — missing token, invalid Firebase token

import assert from "node:assert/strict"
import { test, mock, after } from "node:test"

// Mock Redis module or env so tests do not require a live Redis instance
process.env.INTERNAL_SECRET_KEY = "test-secret"
if (!process.env.REDIS_URL) {
    process.env.REDIS_URL = "redis://127.0.0.1:6379"
}

// Disconnect redis after tests so process exits cleanly
after(async () => {
    try {
        const { default: redis } = await import("../../../shared/redis/redis.js")
        redis.disconnect()
    } catch (e) {}
})

// ─── tiny helpers ────────────────────────────────────────────────────────────

/** Build a minimal req/res/next triple for unit-testing controllers. */
function makeCtx(body = {}, headers = {}) {
    let statusCode = 200
    let responseBody

    const res = {
        status(code) { statusCode = code; return res },
        json(body) { responseBody = body; return res },
        get status_() { return statusCode },
        get body_() { return responseBody },
    }

    const req = {
        body,
        cookies: {},
        get: (name) => headers[name.toLowerCase()] ?? null,
        headers,
    }

    const next = mock.fn()

    return { req, res, next, getStatus: () => statusCode, getBody: () => responseBody }
}

// ─── 1. internalOnly middleware ───────────────────────────────────────────────

test("internalOnly — rejects when INTERNAL_SECRET_KEY env var is missing", async () => {
    const original = process.env.INTERNAL_SECRET_KEY
    delete process.env.INTERNAL_SECRET_KEY

    const { internalOnly } = await import("../middleware/internalOnly.js")
    const { req, res, next, getStatus } = makeCtx()

    internalOnly(req, res, next)

    assert.equal(getStatus(), 500)
    assert.equal(next.mock.calls.length, 0)

    process.env.INTERNAL_SECRET_KEY = original
})

test("internalOnly — rejects when x-internal-secret header is missing", async () => {
    process.env.INTERNAL_SECRET_KEY = "test-secret"

    const { internalOnly } = await import("../middleware/internalOnly.js")
    const { req, res, next, getStatus } = makeCtx({}, {})

    internalOnly(req, res, next)

    assert.equal(getStatus(), 401)
    assert.equal(next.mock.calls.length, 0)
})

test("internalOnly — rejects wrong secret with 403", async () => {
    process.env.INTERNAL_SECRET_KEY = "test-secret"

    const { internalOnly } = await import("../middleware/internalOnly.js")
    const { req, res, next, getStatus } = makeCtx({}, { "x-internal-secret": "wrong" })

    internalOnly(req, res, next)

    assert.equal(getStatus(), 403)
    assert.equal(next.mock.calls.length, 0)
})

test("internalOnly — calls next() with correct secret", async () => {
    process.env.INTERNAL_SECRET_KEY = "test-secret"

    const { internalOnly } = await import("../middleware/internalOnly.js")
    const { req, res, next } = makeCtx({}, { "x-internal-secret": "test-secret" })

    internalOnly(req, res, next)

    assert.equal(next.mock.calls.length, 1)
})

// ─── 2. updateUserPayment ─────────────────────────────────────────────────────

test("updateUserPayment — rejects unknown plan name", async () => {
    const { updateUserPayment } = await import("../controller/auth.contoller.js")

    // Stub User.findById to return a fake user
    const fakeUser = { _id: "u1", credits: 100, totalCredits: 100 }
    mock.method(
        (await import("../model/user_model.js")).default,
        "findById",
        async () => fakeUser
    )

    const { req, res, next, getStatus, getBody } = makeCtx({
        userId: "u1",
        plan: "hacker",     // not in valid_plans
        credits: 100,
    })

    await updateUserPayment(req, res, next)
    assert.equal(getStatus(), 400)
    assert.match(getBody().message, /valid plan/)
})

test("updateUserPayment — rejects credits above max_allowed_credit", async () => {
    const { updateUserPayment } = await import("../controller/auth.contoller.js")

    const fakeUser = { _id: "u1", credits: 100, totalCredits: 100 }
    mock.method(
        (await import("../model/user_model.js")).default,
        "findById",
        async () => fakeUser
    )

    const { req, res, next, getStatus } = makeCtx({
        userId: "u1",
        plan: "pro",
        credits: 99_999,    // way above 10_000 cap
    })

    await updateUserPayment(req, res, next)
    assert.equal(getStatus(), 400)
})

test("updateUserPayment — returns 404 when user does not exist", async () => {
    const { updateUserPayment } = await import("../controller/auth.contoller.js")

    mock.method(
        (await import("../model/user_model.js")).default,
        "findById",
        async () => null
    )

    const { req, res, next, getStatus } = makeCtx({
        userId: "does-not-exist",
        plan: "pro",
        credits: 500,
    })

    await updateUserPayment(req, res, next)
    assert.equal(getStatus(), 404)
})

// ─── 3. deductCredits ────────────────────────────────────────────────────────

test("deductCredits — returns 402 when credits are insufficient", async () => {
    const { deductCredits } = await import("../controller/auth.contoller.js")
    const UserModel = (await import("../model/user_model.js")).default

    // findOneAndUpdate returns null → insufficient credits
    mock.method(UserModel, "findOneAndUpdate", async () => null)
    mock.method(UserModel, "exists", async () => true)  // user exists

    const { req, res, next, getStatus, getBody } = makeCtx({
        userId: "u1",
        agent: "search",   // costs 5 credits
    })

    await deductCredits(req, res, next)
    assert.equal(getStatus(), 402)
    assert.match(getBody().message, /Insufficient/i)
})

test("deductCredits — returns 404 when user does not exist", async () => {
    const { deductCredits } = await import("../controller/auth.contoller.js")
    const UserModel = (await import("../model/user_model.js")).default

    mock.method(UserModel, "findOneAndUpdate", async () => null)
    mock.method(UserModel, "exists", async () => false)  // user missing

    const { req, res, next, getStatus } = makeCtx({ userId: "ghost", agent: "chat" })

    await deductCredits(req, res, next)
    assert.equal(getStatus(), 404)
})

test("deductCredits — succeeds and returns updated credit balance", async () => {
    const { deductCredits } = await import("../controller/auth.contoller.js")
    const UserModel = (await import("../model/user_model.js")).default

    const updatedUser = {
        _id: "u1",
        name: "Test",
        email: "t@t.com",
        avatar: null,
        plan: "pro",
        credits: 95,       // started at 100, cost 5 (search)
        totalCredits: 100,
        planExpiresAt: null,
    }
    mock.method(UserModel, "findOneAndUpdate", async () => updatedUser)

    const { req, res, next, getStatus, getBody } = makeCtx({ userId: "u1", agent: "search" })
    req.cookies.session = undefined   // no session to refresh

    await deductCredits(req, res, next)
    assert.equal(getStatus(), 200)
    assert.equal(getBody().credits, 95)
    assert.equal(getBody().success, true)
})

// ─── 4. login — input validation ──────────────────────────────────────────────

test("login — rejects missing token with 400", async () => {
    const { login } = await import("../controller/auth.contoller.js")
    const { req, res, next, getStatus } = makeCtx({ token: "" })

    await login(req, res, next)
    assert.equal(getStatus(), 400)
})

test("login — rejects non-string token with 400", async () => {
    const { login } = await import("../controller/auth.contoller.js")
    const { req, res, next, getStatus } = makeCtx({ token: 12345 })

    await login(req, res, next)
    assert.equal(getStatus(), 400)
})
