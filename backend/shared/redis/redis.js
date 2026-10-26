import Redis from "ioredis"

const redisUrl = process.env.REDIS_URL

if (!redisUrl) {
    throw new Error("REDIS_URL is required to connect to Redis.")
}

const redis = new Redis(redisUrl)

redis.on("connect",() => {
    console.log("redis connected successfully")
})

redis.on("error", (error) => {
    console.error("Redis connection error:", error.message)
})

export default redis