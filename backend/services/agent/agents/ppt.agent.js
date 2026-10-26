
import { getModel } from "../config/llmModels.js";
import { generatePpt } from "../utils/generatePpt.js";
import { uploadTos3 } from '../utils/uploadToS3.js';
import { getFromS3 } from '../utils/getFromS3.js';
import { deductCredits } from "../utils/deductCredit.js";
import { checkAgentLimit } from "../config/agentLimit.js";

export const pptAgent = async (state) => {
  if (typeof state.prompt !== "string" || !state.prompt.trim()) {
    throw new Error("A non-empty prompt is required.");
  }

  try {
    await checkAgentLimit(state.userId,"ppt")
    
  const llm = await getModel("ppt");
  const systemPrompt = `You are a professional presentation designer and data visualizer.

  Return only one valid JSON object. Do not use Markdown fences.

  Format:

  {
    "title": "Presentation title",
    "subtitle": "Short subtitle",
    "slides": [
      {
        "title": "Slide title",
        "points": ["Concise point", "Another point"],
        "visual": {
          "type": "diagram",
          "title": "Visual title",
          "nodes": ["Step one", "Step two", "Step three"]
        }
      }
    ]
  }

  Rules:

  - Generate exactly 6 content slides.
  - Each slide should have 3-5 concise, useful bullet points.
  - Every slide must include one visual object with type "chart", "diagram", "image", or "none".
  - Use a diagram with 2-6 short nodes for processes, timelines, workflows, or conceptual relationships.
  - Use a chart only when accurate numeric data is provided in the user's request; never invent statistics.
    Chart format: {"type":"chart","title":"Chart title","chartType":"bar","labels":["A","B"],"values":[10,20]}.
    Supported chartType values: "bar", "line", "pie", "doughnut".
  - Use an image for a slide that benefits from an illustration or photo. Image format:
    {"type":"image","title":"Image caption","prompt":"A concise, specific visual description; no text in the image"}.
    Use image generation on at most 2 slides; prefer diagrams for explanatory concepts.
  - Use {"type":"none"} only when no visual would improve the slide.
  - Do not put Markdown in titles, points, labels, or node names.
  - Ensure every string is valid JSON and escape quotation marks correctly.
  - Do not add keys beyond the requested schema.

  TOPIC: 
  ${state.prompt}
  `;

  const response = await llm.invoke(systemPrompt);
  const rawResponse = typeof response.content === "string"
    ? response.content.trim()
    : Array.isArray(response.content)
      ? response.content.map((part) => typeof part === "string" ? part : part.text ?? "").join("").trim()
      : "";

    await deductCredits(state.userId, "ppt")
        
  const cleanedResponse = rawResponse
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const data = JSON.parse(cleanedResponse);

  const ppt = await generatePpt(data)

  const buffer = await ppt.write({
    outputType:"nodebuffer"
  })

  const filename = `ppt-${Date.now()}.pptx`

  await uploadTos3(filename,buffer,"application/vnd.openxmlformats-officedocument.presentationml.presentation")

  const downloadUrl = await getFromS3(filename,600)

  return {
    ...state,
     aiResponse: `# Presentation Generated

  ** ${data.title} **

[Download PowerPoint](${downloadUrl})

Link expires in 10 minutes.

`
  }
  } catch (error) {
    console.log(error)
   console.log(error)
      return {
        ...state,
        aiResponse: error?.data?.message || "failed to generate ppt"
    }
  }

};
