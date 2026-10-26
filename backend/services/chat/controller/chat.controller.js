import mongoose from "mongoose"
import Conversation from "../model/conversation.model.js"
import Message from "../model/msg.model.js"

export const createConversation =  async (req,res) => {
   try {
    const userId = req.get("x-user-id")
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" })
    }

    const conversation = await Conversation.create({
        userId
    })

    return res.status(201).json(conversation)

   } catch (error) {
    console.error("Conversation creation error:", error)
    return res.status(500).json({ message: "Unable to create conversation" })
   }
}



export const getConversation =  async (req,res) => {
   try {
    const userId = req.get("x-user-id")
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" })
    }

    const conversations = await Conversation.find({ userId }).sort({updatedAt:-1})

    return res.status(200).json(conversations)
    
   } catch (error) {
    console.error("Conversation retrieval error:", error)
    return res.status(500).json({ message: "Unable to retrieve conversations" })
   }
}


export const updateConversation =  async (req,res) => {
   try {
    const {id, title} = req.body
    const userId = req.get("x-user-id")
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" })
    }
    if (!mongoose.isValidObjectId(id) || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ message: "A valid conversation ID and title are required" })
    }

    const conversation = await Conversation.findOneAndUpdate(
        { _id: id, userId },
        { title: title.trim() },
        { returnDocument: "after", runValidators: true }
    )
    if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" })
    }

    return res.status(200).json(conversation)
    
   } catch (error) {
    console.error("Conversation update error:", error)
    return res.status(500).json({ message: "Unable to update conversation" })
   }
}


export const saveMessage =  async (req,res) => {
   try {
    const {conversationId,role,content,images,artifacts} = req.body
    const userId = req.get("x-user-id")
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" })
    }
    if (!mongoose.isValidObjectId(conversationId) ||
        !["user", "assistant"].includes(role) ||
        typeof content !== "string" ||
        !content.trim()) {
        return res.status(400).json({ message: "A valid conversation ID, role, and message content are required" })
    }

    const conversation = await Conversation.findOne({ _id: conversationId, userId })
    if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" })
    }

    const message = await Message.create({
        conversationId,
        content: content.trim(),
        role,
        images,
        artifacts
    })

    return res.status(200).json(message)
    
   } catch (error) {
    console.error("Message save error:", error)
    return res.status(500).json({ message: "Unable to save message" })
   }
}


export const getMessages =  async (req,res) => {
   try {
    const { conversationId } = req.params
    const userId = req.get("x-user-id")
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" })
    }
    if (!mongoose.isValidObjectId(conversationId)) {
        return res.status(400).json({ message: "A valid conversation ID is required" })
    }
    const conversation = await Conversation.findOne({ _id: conversationId, userId })
    if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" })
    }

    const messages = await Message.find({ conversationId })
    return res.status(200).json(messages)
    
   } catch (error) {
    console.error("Message retrieval error:", error)
    return res.status(500).json({ message: "Unable to retrieve messages" })
   }
}