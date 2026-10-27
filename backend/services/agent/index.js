import "dotenv/config"

import dns from "node:dns"
dns.setServers(["8.8.8.8", "8.8.4.4"])

import express from "express"
import connectDB from "./config/db.js"
import router from "./routes/agent.route.js"


const port = process.env.PORT

if (!port) {
    throw new Error("PORT is required to start the agent service.")
}

const app = express()
app.use(express.json())

app.use("/",router)

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error("[agent] Unhandled error:", err)

    const status = Number.isInteger(err.status) ? err.status : 500

    // Rate-limit errors carry a structured err.data payload — forward it as-is.
    if (err.data) {
        return res.status(status).json(err.data)
    }

    return res.status(status).json({
        success: false,
        message: err.message || "An unexpected agent error occurred.",
    })
})

app.get("/", (req,res)=>{
 res.json({message: "hello from agent "})
})

try {
    await connectDB()
    app.listen(port, () => {
        console.log(`agent running at ${port}`)
    })
} catch (error) {
    console.error("Unable to start agent service:", error)
    process.exit(1)
}
