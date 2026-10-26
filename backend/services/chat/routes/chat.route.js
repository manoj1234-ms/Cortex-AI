import express from "express"
import { createConversation, getConversation, getMessages, saveMessage, updateConversation } from "../controller/chat.controller.js"

const router = express.Router()

router.post("/create-conversation", createConversation)
router.get("/get-conversations", getConversation)
router.post("/update-conversation", updateConversation)
router.post("/save-message", saveMessage)
router.get("/get-message/:conversationId",getMessages)

export default router