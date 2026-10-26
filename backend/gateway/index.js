import "dotenv/config"

import express from "express"
import proxy from "express-http-proxy"
import cors from "cors"
import cookieParser from "cookie-parser"

import protect from "../gateway/middleware/auth.middleware.js"
import { getCurrentUser } from "./controller/user.controller.js"
import { proxyWithHeader } from "./utils/proxyWithHeader.js"
import morgan from "morgan"

const port = process.env.PORT

for (const name of ["PORT", "FRONTEND_URL", "AUTH_SERVICE", "CHAT_SERVICE", "AGENT_SERVICE"]) {
    if (!process.env[name]) {
        throw new Error(`${name} is required to start the gateway.`)
    }
}

const app = express()

app.use(cors({
    origin:process.env.FRONTEND_URL,
    credentials:true
}))

app.use(morgan("dev"))
app.use(cookieParser())
app.use("/api/auth", proxy(process.env.AUTH_SERVICE))
app.use("/api/chat", protect,proxyWithHeader(process.env.CHAT_SERVICE))
app.use("/api/agent", protect,proxyWithHeader(process.env.AGENT_SERVICE, { limit: "55mb" }))
app.use("/api/billing", protect,proxyWithHeader(process.env.BILLING_SERVICE))
app.get("/api/me", protect, getCurrentUser)


app.get("/", (req,res)=>{
 res.json({message: "hello from gateway v5"})
})

app.listen(port, () => {
    console.log(`gateway running at ${port}`)
})
