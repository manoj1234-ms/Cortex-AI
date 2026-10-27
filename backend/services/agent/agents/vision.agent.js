
import { getModel } from "../config/llmModels.js";
import  axios  from 'axios';
import { uploadTos3 } from '../utils/uploadToS3.js';
import { getFromS3 } from '../utils/getFromS3.js';
import { deductCredits } from "../utils/deductCredit.js";
import { checkAgentLimit } from "../config/agentLimit.js";

export const visionAgent = async (state) => {
  if (typeof state.prompt !== "string" || !state.prompt.trim()) {
    throw new Error("A non-empty prompt is required.");
  }
   
  try {
  await checkAgentLimit(state.userId,"image")

  const llm = await getModel("vision");
  const response = await llm.invoke(`
  You are an elite AI image prompt engineer.

  Convert the user request into a highly detailed image generation prompt.

  Requirements:

  -Cinematic lighting
  -Professional compostion
  -Ultra detail
  -Beautiful color palatte
  -Sharp focus
  -8k quality 
  -Photorealistic
  -Depth of field
  -professional photography
  -Stunning visuals

  Return only the image prompt.

  User Request:
  ${state.prompt}
  `)

  const prompt = typeof response.content === "string"
    ? response.content.trim()
    : response.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("")
        .trim()
   

  if (!prompt) {
    throw new Error("The image prompt model returned an empty prompt.");
  }

  const imageUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=${encodeURIComponent("black-forest-labs/flux.1-schnell")}`

  const imageRes = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    timeout: 120_000,
    headers: process.env.POLLINATIONS_API_KEY
      ? { Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}` }
      : undefined,
  })

  await deductCredits(state.userId, "vision")   

  const contentType = imageRes.headers["content-type"]?.split(";")[0]
  const extensionByContentType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }
  const extension = extensionByContentType[contentType]

  if (!extension) {
    throw new Error(`Image service returned an unsupported content type: ${contentType ?? "unknown"}.`);
  }

  const buffer = Buffer.from(imageRes.data)

  const filename = `image-${Date.now()}.${extension}`

  await uploadTos3(filename, buffer, contentType)

  const downloadUrl = await getFromS3(filename, 600)
  
  return {
    ...state,
    searchImages: [downloadUrl],
    aiResponse: `# 
[Download Image](${downloadUrl})

Link expires in 10 minutes.`,
  }  
    
  } catch (error) {
    console.error("[visionAgent] Error:", error)
    throw error
  }
};
