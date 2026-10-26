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

app.use((err,req,res,next) => {
    console.log(err)

    if(err.status){
        return res.status(err.status).json(err.data)
    }

    return res.status(500).json({
        message: `agent error ${err}`
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
