import "dotenv/config"

import dns from "node:dns"
dns.setServers(["8.8.8.8", "8.8.4.4"])

import express from "express"
import connectDB from "./config/db.js"
import router from "./routes/auth.route.js"

const port = process.env.PORT

if (!port) {
    throw new Error("PORT is required to start the auth service.")
}

const app = express()
app.use(express.json())
app.use("/", router)

app.get("/", (req,res)=>{
 res.json({message: "hello from auth "})
})

try {
    await connectDB()
    app.listen(port, () => {
        console.log(`auth running at ${port}`)
    })
} catch (error) {
    console.error("Unable to start auth service:", error)
    process.exit(1)
}
