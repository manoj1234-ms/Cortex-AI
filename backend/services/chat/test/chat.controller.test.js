// Chat service tests — uses Node's built-in test runner (node:test)
// Run: node --experimental-vm-modules --test test/chat.controller.test.js
//
// What is tested:
//  1. All handlers require x-user-id (401)
//  2. Invalid ObjectId / bad body → 400
//  3. updateConversation scoped to owner (filter check)
//  4. saveMessage — invalid role, empty content, cross-user access
//  5. getMessages  — cross-user access, happy path returns messages
//  6. createConversation — happy path returns 201

import assert from "node:assert/strict"
import { test } from "node:test"
import Conversation from "../model/conversation.model.js"
import Message from "../model/msg.model.js"
import {
    createConversation,
    getConversation,
    getMessages,
    saveMessage,
    updateConversation,
} from "../controller/chat.controller.js"

const VALID_ID = "507f1f77bcf86cd799439011"

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeRes = () => {
    const res = { statusCode: null, body: null }
    res.status = (code) => { res.statusCode = code; return res }
    res.json   = (body)  => { res.body = body;       return res }
    return res
}

const makeReq = ({ userId, body = {}, params = {} } = {}) => ({
    get:    (h) => h === "x-user-id" ? userId : undefined,
    body,
    params,
})

// ─── 1. Auth guard — all handlers must require x-user-id ─────────────────────

test("all handlers return 401 when x-user-id is missing", async () => {
    const handlers = [
        createConversation,
        getConversation,
        updateConversation,
        saveMessage,
        getMessages,
    ]
    for (const handler of handlers) {
        const res = makeRes()
        await handler(makeReq(), res)    // no userId
        assert.equal(res.statusCode, 401, `${handler.name} should 401`)
    }
})

// ─── 2. Input validation — 400 for bad IDs / body ────────────────────────────

test("handlers return 400 for invalid ObjectIds and malformed bodies", async () => {
    const cases = [
        [updateConversation, { id: "not-an-id", title: "Title" }, {}],
        [updateConversation, { id: VALID_ID,    title: "   " },   {}],  // blank title
        [saveMessage,        { conversationId: "not-an-id", role: "user",      content: "Hi" }, {}],
        [saveMessage,        { conversationId: VALID_ID,    role: "robot",     content: "Hi" }, {}],  // invalid role
        [saveMessage,        { conversationId: VALID_ID,    role: "user",      content: "  " }, {}],  // blank content
        [getMessages,        {}, { conversationId: "not-an-id" }],
    ]
    for (const [handler, body, params] of cases) {
        const res = makeRes()
        await handler(makeReq({ userId: "u1", body, params }), res)
        assert.equal(res.statusCode, 400, `${handler.name} with body=${JSON.stringify(body)}`)
    }
})

// ─── 3. updateConversation — query must include userId (ownership check) ──────

test("updateConversation passes userId in the DB filter (ownership enforced)", async () => {
    const orig = Conversation.findOneAndUpdate
    let capturedFilter

    Conversation.findOneAndUpdate = async (filter) => {
        capturedFilter = filter
        return null   // simulate not found → 404
    }

    const res = makeRes()
    await updateConversation(
        makeReq({ userId: "u1", body: { id: VALID_ID, title: "New title" } }),
        res
    )

    assert.deepEqual(capturedFilter, { _id: VALID_ID, userId: "u1" })
    assert.equal(res.statusCode, 404)

    Conversation.findOneAndUpdate = orig
})

// ─── 4. saveMessage — cross-user access blocked ───────────────────────────────

test("saveMessage returns 404 when conversation belongs to another user", async () => {
    const orig = Conversation.findOne
    Conversation.findOne = async () => null   // not found for this user

    const res = makeRes()
    await saveMessage(makeReq({
        userId: "u1",
        body: { conversationId: VALID_ID, role: "user", content: "Hello" },
    }), res)

    assert.equal(res.statusCode, 404)
    Conversation.findOne = orig
})

test("saveMessage returns 404 for assistant role belonging to another user", async () => {
    const orig = Conversation.findOne
    Conversation.findOne = async () => null

    const res = makeRes()
    await saveMessage(makeReq({
        userId: "u2",
        body: { conversationId: VALID_ID, role: "assistant", content: "Sure!" },
    }), res)

    assert.equal(res.statusCode, 404)
    Conversation.findOne = orig
})

test("saveMessage creates and returns the message on success", async () => {
    const origFind   = Conversation.findOne
    const origCreate = Message.create

    const fakeMsg = { _id: "msg1", conversationId: VALID_ID, role: "user", content: "Hello" }
    Conversation.findOne = async () => ({ _id: VALID_ID })
    Message.create       = async () => fakeMsg

    const res = makeRes()
    await saveMessage(makeReq({
        userId: "u1",
        body: { conversationId: VALID_ID, role: "user", content: "  Hello  " },
    }), res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, fakeMsg)

    Conversation.findOne = origFind
    Message.create       = origCreate
})

// ─── 5. getMessages — cross-user blocked, happy path ─────────────────────────

test("getMessages returns 404 when conversation belongs to another user", async () => {
    const orig = Conversation.findOne
    Conversation.findOne = async () => null

    const res = makeRes()
    await getMessages(
        makeReq({ userId: "u1", params: { conversationId: VALID_ID } }),
        res
    )

    assert.equal(res.statusCode, 404)
    Conversation.findOne = orig
})

test("getMessages returns the message array for the conversation owner", async () => {
    const origConv = Conversation.findOne
    const origMsg  = Message.find

    const fakeMessages = [
        { content: "First msg",  role: "user" },
        { content: "Second msg", role: "assistant" },
    ]
    Conversation.findOne = async () => ({ _id: VALID_ID })
    Message.find         = async () => fakeMessages  // controller calls find() directly — no .sort()

    const res = makeRes()
    await getMessages(
        makeReq({ userId: "u1", params: { conversationId: VALID_ID } }),
        res
    )

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, fakeMessages)

    Conversation.findOne = origConv
    Message.find         = origMsg
})

// ─── 6. createConversation — happy path ───────────────────────────────────────

test("createConversation returns 201 with the new conversation", async () => {
    const orig = Conversation.create
    const fakeConv = { _id: "c1", userId: "u1" }
    Conversation.create = async () => fakeConv

    const res = makeRes()
    await createConversation(makeReq({ userId: "u1" }), res)

    assert.equal(res.statusCode, 201)
    assert.deepEqual(res.body, fakeConv)

    Conversation.create = orig
})

// ─── 7. getConversation — returns list for the owner ─────────────────────────

test("getConversation returns sorted conversations for the owner", async () => {
    const orig = Conversation.find
    const fakeConvs = [{ _id: "c2" }, { _id: "c1" }]
    Conversation.find = () => ({ sort: async () => fakeConvs })

    const res = makeRes()
    await getConversation(makeReq({ userId: "u1" }), res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, fakeConvs)

    Conversation.find = orig
})
