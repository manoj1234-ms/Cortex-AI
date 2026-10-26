import mongoose from "mongoose"

const conversationSchema = new mongoose.Schema({
    title:{
        type:String,
        trim:true,
        default:"New Chat"
    },
    userId:{
        type:String,
        required:true,
        index:true
    }
},{
    timestamps:true
})

const Conversation = mongoose.model("Conversation", conversationSchema)

export default Conversation