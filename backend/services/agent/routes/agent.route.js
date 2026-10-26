import express from "express"
import { createAgentHandler } from "../contollers/agent.contoller.js"
import multer from '../config/multer.js';

export const createAgentRouter = () => {
    const router = express.Router()

    router.post("/chat",multer.single("file"),createAgentHandler)
    router.post("/debug",createAgentHandler)
    router.post("/coding",createAgentHandler)
    router.post("/search",createAgentHandler)
    router.post("/pdf",createAgentHandler)
    router.post("/ppt",createAgentHandler)
    router.post("/vision",createAgentHandler)

    return router
}

export default createAgentRouter()