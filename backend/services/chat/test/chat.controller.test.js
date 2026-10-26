import assert from "node:assert/strict"
import test from "node:test"
import Conversation from "../model/conversation.model.js"
import Message from "../model/msg.model.js"
import {
    createConversation,
    getConversation,
    getMessages,
    saveMessage,
    updateConversation,
} from "../controller/chat.controller.js"

const validConversationId = "507f1f77bcf86cd799439011"

const createResponse = () => ({
    statusCode: null,
    body: null,
    status(code) {
        this.statusCode = code
        return this
    },
    json(body) {
        this.body = body
        return body
    },
})

const createRequest = ({ userId, body = {}, params = {} } = {}) => ({
    get: (header) => header === "x-user-id" ? userId : undefined,
    body,
    params,
})

test("all conversation and message handlers require an authenticated user", async () => {
    const handlers = [
        createConversation,
        getConversation,
        updateConversation,
        saveMessage,
        getMessages,
    ]

    for (const handler of handlers) {
        const response = createResponse()
        await handler(createRequest(), response)
        assert.equal(response.statusCode, 401)
    }
})

test("message and conversation handlers reject malformed identifiers", async () => {
    const cases = [
        [updateConversation, { id: "invalid", title: "Title" }, {}],
        [saveMessage, { conversationId: "invalid", role: "user", content: "Hello" }, {}],
        [getMessages, {}, { conversationId: "invalid" }],
    ]

    for (const [handler, body, params] of cases) {
        const response = createResponse()
        await handler(createRequest({ userId: "user-1", body, params }), response)
        assert.equal(response.statusCode, 400)
    }
})

test("conversation updates are scoped to the authenticated owner", async (context) => {
    const originalFindOneAndUpdate = Conversation.findOneAndUpdate
    let filter
    Conversation.findOneAndUpdate = async (query) => {
        filter = query
        return null
    }
    context.after(() => {
        Conversation.findOneAndUpdate = originalFindOneAndUpdate
    })

    const response = createResponse()
    await updateConversation(
        createRequest({
            userId: "user-1",
            body: { id: validConversationId, title: "Updated title" },
        }),
        response,
    )

    assert.deepEqual(filter, { _id: validConversationId, userId: "user-1" })
    assert.equal(response.statusCode, 404)
})

test("messages cannot be saved to another user's conversation", async (context) => {
    const originalFindOne = Conversation.findOne
    Conversation.findOne = async () => null
    context.after(() => {
        Conversation.findOne = originalFindOne
    })

    const response = createResponse()
    await saveMessage(
        createRequest({
            userId: "user-1",
            body: {
                conversationId: validConversationId,
                role: "user",
                content: "Hello",
            },
        }),
        response,
    )

    assert.equal(response.statusCode, 404)
})

test("message history is only returned to the conversation owner", async (context) => {
    const originalFindOne = Conversation.findOne
    Conversation.findOne = async () => null
    context.after(() => {
        Conversation.findOne = originalFindOne
    })

    const response = createResponse()
    await getMessages(
        createRequest({
            userId: "user-1",
            params: { conversationId: validConversationId },
        }),
        response,
    )

    assert.equal(response.statusCode, 404)
})

test("message history is returned in chronological order", async (context) => {
    const originalFindOne = Conversation.findOne
    const originalFind = Message.find
    const messages = [{ content: "First" }, { content: "Second" }]
    let sortOrder

    Conversation.findOne = async () => ({ _id: validConversationId })
    Message.find = () => ({
        sort: async (order) => {
            sortOrder = order
            return messages
        },
    })
    context.after(() => {
        Conversation.findOne = originalFindOne
        Message.find = originalFind
    })

    const response = createResponse()
    await getMessages(
        createRequest({
            userId: "user-1",
            params: { conversationId: validConversationId },
        }),
        response,
    )

    assert.deepEqual(sortOrder, { createdAt: 1 })
    assert.deepEqual(response.body, messages)
})
