// Billing service tests — uses Node's built-in test runner (node:test)
// Run: node --experimental-vm-modules --test test/billing.test.js
//
// What is tested:
//  1. verifyPayment  — idempotency (already paid), concurrent race condition
//  2. verifyPayment  — incomplete Razorpay fields, wrong userId
//  3. verifyPayment  — signature verification (bad sig rejects)
//  4. createOrder    — missing userId, invalid plan

import assert from "node:assert/strict"
import { test, mock } from "node:test"
import crypto from "node:crypto"

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeCtx(body = {}, headers = {}) {
    let statusCode = 200
    let responseBody

    const res = {
        status(code) { statusCode = code; return res },
        json(body) { responseBody = body; return res },
    }
    const req = {
        body,
        cookies: {},
        get: (name) => headers[name.toLowerCase()] ?? null,
        headers,
    }

    return { req, res, getStatus: () => statusCode, getBody: () => responseBody }
}

/** Build a valid Razorpay HMAC signature for testing the happy path. */
function makeSignature(orderId, paymentId, secret) {
    return crypto
        .createHmac("sha256", secret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex")
}

// ─── 1. verifyPayment — input validation ─────────────────────────────────────

test("verifyPayment — returns 400 when Razorpay fields are incomplete", async () => {
    const { verifyPayment } = await import("../controller/billing.controller.js")

    const { req, res, getStatus } = makeCtx(
        { razorpay_order_id: "ord_123" }, // missing payment_id and signature
        { "x-user-id": "u1" }
    )

    await verifyPayment(req, res)
    assert.equal(getStatus(), 400)
})

test("verifyPayment — returns 401 when x-user-id header is missing", async () => {
    const { verifyPayment } = await import("../controller/billing.controller.js")

    const { req, res, getStatus } = makeCtx({
        razorpay_order_id: "ord_1",
        razorpay_payment_id: "pay_1",
        razorpay_signature: "sig_1",
    })  // no x-user-id header

    await verifyPayment(req, res)
    assert.equal(getStatus(), 401)
})

// ─── 2. verifyPayment — signature check ──────────────────────────────────────

test("verifyPayment — rejects an invalid signature with 400", async () => {
    process.env.RAZORPAY_KEY_SECRET = "test-key-secret"
    process.env.AUTH_SERVICE = "http://localhost:9999"

    const { verifyPayment } = await import("../controller/billing.controller.js")

    const { req, res, getStatus } = makeCtx({
        razorpay_order_id: "ord_abc",
        razorpay_payment_id: "pay_abc",
        razorpay_signature: "definitely-not-a-valid-hmac",
    }, { "x-user-id": "u1" })

    await verifyPayment(req, res)
    assert.equal(getStatus(), 400)
})

// ─── 3. verifyPayment — idempotency ──────────────────────────────────────────

test("verifyPayment — returns 200 immediately when payment is already paid", async () => {
    process.env.RAZORPAY_KEY_SECRET = "test-key-secret"

    const { verifyPayment } = await import("../controller/billing.controller.js")
    const Payment = (await import("../models/payment.model.js")).default

    const orderId = "ord_already_paid"
    const paymentId = "pay_already_paid"
    const sig = makeSignature(orderId, paymentId, "test-key-secret")

    mock.method(Payment, "findOne", async () => ({
        userId: "u1",
        status: "paid",   // ← already paid
        plan: "pro",
        credits: 500,
    }))

    const { req, res, getStatus, getBody } = makeCtx({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
    }, { "x-user-id": "u1" })

    await verifyPayment(req, res)
    assert.equal(getStatus(), 200)
    assert.match(getBody().message, /already verified/i)
})

test("verifyPayment — concurrent race: findOneAndUpdate returning null returns 400", async () => {
    process.env.RAZORPAY_KEY_SECRET = "test-key-secret"

    const { verifyPayment } = await import("../controller/billing.controller.js")
    const Payment = (await import("../models/payment.model.js")).default

    const orderId = "ord_race"
    const paymentId = "pay_race"
    const sig = makeSignature(orderId, paymentId, "test-key-secret")

    // findOne returns "created" but findOneAndUpdate returns null
    // (another request already claimed it)
    mock.method(Payment, "findOne", async () => ({
        userId: "u1",
        status: "created",
        plan: "pro",
        credits: 500,
    }))
    mock.method(Payment, "findOneAndUpdate", async () => null)

    const { req, res, getStatus, getBody } = makeCtx({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
    }, { "x-user-id": "u1" })

    await verifyPayment(req, res)
    assert.equal(getStatus(), 400)
    assert.match(getBody().message, /already processed/i)
})

test("verifyPayment — returns 403 when payment belongs to a different user", async () => {
    process.env.RAZORPAY_KEY_SECRET = "test-key-secret"

    const { verifyPayment } = await import("../controller/billing.controller.js")
    const Payment = (await import("../models/payment.model.js")).default

    const orderId = "ord_other"
    const paymentId = "pay_other"
    const sig = makeSignature(orderId, paymentId, "test-key-secret")

    mock.method(Payment, "findOne", async () => ({
        userId: "u999",   // ← different user owns this order
        status: "created",
    }))

    const { req, res, getStatus } = makeCtx({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
    }, { "x-user-id": "u1" })

    await verifyPayment(req, res)
    assert.equal(getStatus(), 403)
})

// ─── 4. createOrder ───────────────────────────────────────────────────────────

test("createOrder — returns 401 when x-user-id header is missing", async () => {
    const { createOrder } = await import("../controller/billing.controller.js")

    const { req, res, getStatus } = makeCtx({ plan: "pro" })
    await createOrder(req, res)
    assert.equal(getStatus(), 401)
})

test("createOrder — returns 400 for the free plan", async () => {
    const { createOrder } = await import("../controller/billing.controller.js")

    const { req, res, getStatus } = makeCtx(
        { plan: "free" },
        { "x-user-id": "u1" }
    )
    await createOrder(req, res)
    assert.equal(getStatus(), 400)
})

test("createOrder — returns 400 for an unknown plan name", async () => {
    const { createOrder } = await import("../controller/billing.controller.js")

    const { req, res, getStatus } = makeCtx(
        { plan: "galaxy-brain" },
        { "x-user-id": "u1" }
    )
    await createOrder(req, res)
    assert.equal(getStatus(), 400)
})
