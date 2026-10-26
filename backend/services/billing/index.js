import "dotenv/config"

import dns from "node:dns"
dns.setServers(["8.8.8.8", "8.8.4.4"])

import express from "express"
import connectDB from "./config/db.js"
import router from './routes/billing.route.js';


const port = process.env.PORT

if (!port) {
    throw new Error("PORT is required to start the auth service.")
}

const app = express()
app.use(express.json())
app.use("/", router)

app.get("/", (req,res)=>{
 res.json({message: "hello from billing "})
})

try {
    await connectDB()
    app.listen(port, () => {
        console.log(`billing running at ${port}`)
    })
} catch (error) {
    console.error("Unable to start biling service:", error)
    process.exit(1)
}
