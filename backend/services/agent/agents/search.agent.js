import { searchTool } from './../config/tavily.js';
import { deductCredits } from "../utils/deductCredit.js";
import { checkAgentLimit } from '../config/agentLimit.js';

export const searchAgent = async (state) => {
  try {
    await checkAgentLimit(state.userId, "search")
    const prompt = state.prompt.toLowerCase()
    const topic = /\b(stock|stocks|finance|financial|market|markets|investment|investing|earnings|revenue|crypto|cryptocurrency)\b/.test(prompt)
      ? "finance"
      : /\b(news|latest|recent|today|yesterday|breaking|current event)\b/.test(prompt)
        ? "news"
        : "general"

    const results = await searchTool.invoke({
      query: state.prompt,
      topic
    })
    const images = Array.isArray(results.images)
      ? results.images
        .map(image => typeof image === "string" ? image : image?.url)
        .filter(image => typeof image === "string" && image.length > 0)
      : []

    await deductCredits(state.userId, "search")
    return {
      ...state,
      searchResults: results.results ?? results,
      searchImages: images
    }
  } catch (error) {
    console.error("[searchAgent] Search request failed:", error)
    throw error
  }
}