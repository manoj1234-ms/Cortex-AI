
import axios from 'axios';
import { graph } from './../graph/graph.js';
import { addMessages, getMemory } from "../config/memory.js"

export const createAgentHandler =async (req, res, next) => {
    try {
        const { prompt, conversationId,agent } = req.body
        const file = req.file
        const userId = req.get("x-user-id")

        await getMemory(conversationId, userId)

        await axios.post(`${process.env.CHAT_URL}/save-message`,{
            conversationId, role:"user", content:prompt
        },{
            headers: { "x-user-id": userId }
        })


        const result = await graph.invoke({
            prompt, conversationId, userId, agent, file
        })

        const response = result.aiResponse
        const images = result.searchImages ?? []
        if (typeof response !== "string" || !response.trim()) {
            throw new Error("The selected agent returned an empty response.")
        }

        await addMessages(conversationId, "user", prompt)
        await addMessages(conversationId, "assistant", response)
        
        await axios.post(`${process.env.CHAT_URL}/save-message`,{
            conversationId,
            role:"assistant",
            content:response,
            images,
            artifacts:result.artifacts
        },{
            headers: { "x-user-id": userId }
        })
       

        return res.status(200).json({
            answer:response,
            images,
            artifacts: result.artifacts
        })

    } catch (error) {
        next(error)
    }
}

export default createAgentHandler