import mongoose from "mongoose"

const connectDB = async() => {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is required to connect to MongoDB.")
    }

    await mongoose.connect(process.env.MONGO_URI)
    console.log("MongoDB connected successfully")
}

export default connectDB



