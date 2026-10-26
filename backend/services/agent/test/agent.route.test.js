import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import express from "express"
import "dotenv/config"

const { createAgentRouter } = await import("../routes/agent.route.js")

const calls = []
const app = express()
app.use(express.json())
app.use("/api/agent", createAgentRouter({
    invokeGraph: async (state) => {
        calls.push({ type: "invoke", state })
        return { aiResponse: `response:${state.requestedAgent ?? "auto"}` }
    },
    saveMessage: async (message) => {
        calls.push({ type: "save", message })
    },
}))

let server
let baseUrl

before(async () => {
    server = app.listen(0)
    await new Promise((resolve, reject) => {
        server.once("listening", resolve)
        server.once("error", reject)
    })
    baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
    if (server?.listening) {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve())
        })
    }
})

test("chat and each specialized agent endpoint dispatch successfully", async () => {
    const endpoints = [
        ["chat", undefined],
        ["debug", "debug"],
        ["coding", "coding"],
        ["search", "search"],
        ["pdf", "pdf"],
        ["ppt", "ppt"],
        ["vision", "vision"],
    ]

    for (const [path, expectedAgent] of endpoints) {
        const response = await fetch(`${baseUrl}/api/agent/${path}`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-user-id": "test-user",
            },
            body: JSON.stringify({
                prompt: "Please help",
                conversationId: "507f1f77bcf86cd799439011",
            }),
        })

        assert.equal(response.status, 200, `${path} route status`)
        assert.equal(await response.json(), `response:${expectedAgent ?? "auto"}`)

        const invocation = calls.findLast((call) => call.type === "invoke")
        assert.equal(invocation.state.requestedAgent, expectedAgent)
    }

    assert.equal(calls.filter((call) => call.type === "save").length, endpoints.length * 2)
})

test("agent endpoints reject missing identity and malformed request bodies", async () => {
    const unauthenticated = await fetch(`${baseUrl}/api/agent/debug`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            prompt: "Please help",
            conversationId: "507f1f77bcf86cd799439011",
        }),
    })
    assert.equal(unauthenticated.status, 401)

    const invalidRequest = await fetch(`${baseUrl}/api/agent/debug`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-user-id": "test-user",
        },
        body: JSON.stringify({ prompt: "  ", conversationId: "invalid" }),
    })
    assert.equal(invalidRequest.status, 400)
})
