import mongoose from "mongoose"


const fileSchema = new mongoose.Schema({
    name:String,
    content:String
}, {
    _id:false
})

const artifactSchema =  new mongoose.Schema({
    title:String,
    id:Number,
    type:String,
    files:[fileSchema]
},{
    _id:false
})

const messageSchema = new mongoose.Schema({
    conversationId:{
       type: mongoose.Schema.Types.ObjectId,
       ref:"Conversation",
       required:true,
       index:true
    },
    role:{
        type:String,
        enum:["user", "assistant"],
        required:true
    },
    content:{
        type:String,
        required:true,
        trim:true
    },
    images:[String],
    artifacts:[artifactSchema]
},{
    timestamps:true
})

const Message = mongoose.model("Message", messageSchema)

export default Message