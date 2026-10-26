import { getModel } from "../config/llmModels.js"
import { readFile, rm } from "node:fs/promises"
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { deductCredits } from "../utils/deductCredit.js";
import { checkAgentLimit } from "../config/agentLimit.js";

export const imageAnalyzer = async(state) => {
  if (!state.file?.path || !state.file?.mimetype?.startsWith("image/")) {
    throw new Error("Upload an image before asking a question.");
  }

  try {
    await checkAgentLimit(state.userId, "image");
    const llm = await getModel("imageAnalyzer");

    const imageBuffer = await readFile(state.file.path);

    const base64image = imageBuffer.toString("base64");

    const messages = [
      new SystemMessage(
        `
            You are ConvexAI image analyzer Agent.

            Rules:

            - Analyze only the uploaded image.
            - Answer the user's question accurately.
            - If text exists in the image, extract it.
            - If charts or table exist, explain them.
            - If something is unclear, say so.
            - Use Markdown when helpful.
            - Do not hallucinate.
         `
      ),
      new HumanMessage({
        content: [
          {
            type: "text",
            text: state.prompt || "Analyze the image"
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${state.file.mimetype};base64,${base64image}`
            }
          }
        ]
      })
    ];

    const response = await llm.invoke(messages);
    const answer = typeof response.content === "string"
      ? response.content
      : response.content
          .filter(part => part.type === "text")
          .map(part => part.text)
          .join("");

    if (!answer.trim()) {
      throw new Error("The image analyzer returned an empty response.");
    }

    await deductCredits(state.userId, "vision");

    return {
      ...state,
      aiResponse: answer
    };
  } catch (error) {
    console.error("[imageAnalyzer] Image analysis failed:", error);
     return {
        ...state,
        aiResponse: error?.data?.message || "failed to analyze the image"
    }
  } finally {
    await rm(state.file.path, { force: true });
  }
}
