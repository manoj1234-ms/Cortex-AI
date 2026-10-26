import axios from "axios"

export const getMessages = async (conversationId, userId) => {
    const { data } = await axios.get(
        `${process.env.CHAT_URL}/get-message/${conversationId}`,
        { headers: { "x-user-id": userId } }
    )
    return data
}