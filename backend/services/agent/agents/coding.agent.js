
import { getModel } from "../config/llmModels.js";
import { normalizeJson } from "../utils/normalizeJson.js";
import { deductCredits } from "../utils/deductCredit.js";
import {checkAgentLimit} from "../config/agentLimit.js"

const extractContent = (content) => {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string" ? part : part?.text ?? ""
      )
      .join("");
  }

  return String(content ?? "");
};

export const codingAgent = async (state) => {
  try {

  await checkAgentLimit(state.userId,"coding")

  const intentllm = await getModel("intent");
  const llm = await getModel("coding");

  const intentRes = await intentllm.invoke(`
You are an intent classifier.

Return exactly one label:
CODE_GENERATION
CODE_REVIEW
CODE_EXPLANATION
DEBUGGING
OPTIMIZATION
CONVERSION
DOCUMENTATION

Classify the user's primary intent.
Return the label only, without punctuation or explanation.

User Request:
${state.prompt}
`);

  const intent = extractContent(intentRes.content)
    .trim()
    .toUpperCase();

  if (intent === "CODE_GENERATION") {
    const prompt = `
You are Cortex AI, a professional code generation engine.

USER REQUEST:
${state.prompt}

Requirements:
1. Identify the language, framework, libraries, and platform.
2. Follow the requested stack and provided project context.
3. Generate complete, runnable code with correct imports.
4. For frontend UI, use responsive, mobile-first import { deductCredits } from './../../auth/controller/auth.contoller';
layouts,import { deductCredits } from './../utils/deductCredit';

   CSS variables, Flexbox/Grid, and accessible HTML where relevant.
5. Reuse the project's existing styling approach and dependencies.
6. Include proper error handling, input validation, and security.
7. Do not invent project files, APIs, or execution results.
8. Whenever the UI needs photos or illustrations, use real Unsplash image URLs
   from images.unsplash.com with relevant photo IDs. Never use placeholders,
   placeholder services, empty image sources, or fake/local image paths.
   Include descriptive alt text and use appropriate image sizing/cropping.
   For food imagery, suitable real Unsplash photos include:
   https://images.unsplash.com/photo-1546069901-ba9599a7e63c
   https://images.unsplash.com/photo-1568901346375-23c9450c58cd
   https://images.unsplash.com/photo-1565299624946-b28f40a0ae38
   Add image parameters such as ?auto=format&fit=crop&w=900&q=80 as needed.
9. For every request to build a website or app, include a first file named
   "preview.html". It must be a complete, self-contained browser preview of
   the requested frontend, with its CSS and browser JavaScript inline. Do not
   use JSX, Node.js APIs, build tools, or external dependencies in this file.
   Keep the actual requested project files too (including React and Express
   source for MERN requests); preview.html is a runnable visual demo, not a
   replacement for the project.
10. Return only valid JSON. No Markdown fences or surrounding text.
11. Escape file contents correctly as JSON strings.

Return this schema:
{
  "status": "success",
  "intent": "CODE_GENERATION",
  "stack": {
    "language": "string",
    "framework": "string",
    "libraries": [],
    "platform": "string"
  },
  "summary": "string",
  "files": [
    {
      "filename": "relative/file/path",
      "language": "string",
      "code": "complete file contents"
    }
  ],
  "dependencies": [],
  "assumptions": [],
  "runInstructions": []
}

If clarification is essential, return status "needs_clarification"
and an empty files array.
`;

    const res = await llm.invoke(prompt);
    const data = normalizeJson(res.content);

    if (
      !data ||
      typeof data !== "object" ||
      !Array.isArray(data.files)
    ) {
      throw new Error("Invalid code-generation response schema.");
    }

    await deductCredits(state.userId, "coding")

    const files = data.files.map((file) => ({
      name: file?.filename ?? file?.name ?? file?.path,
      content: file?.code ?? file?.content,
    }));
    const isWebsiteRequest = /\b(website|web app|web application|frontend|front-end|mern|react)\b/i.test(state.prompt);

    if (
      data.status === "success" &&
      (!files.length ||
        files.some(
          (file) =>
            typeof file.name !== "string" ||
            !file.name.trim() ||
            typeof file.content !== "string"
        ))
    ) {
      throw new Error("Generated files must include a filename and code content.");
    }
    if (
        data.status === "success" &&
        isWebsiteRequest &&
        !files.some((file) => file.name.toLowerCase() === "preview.html")
    ) {
        throw new Error("Website projects must include a runnable preview.html file.");
    }

    return {
      ...state,
      aiResponse:
        data.status === "success"
          ? "Code generated successfully."
          : data.summary ?? "More information is required.",
      artifacts:
        data.status === "success"
          ? [
              {
                id: Date.now(),
                type: "Project",
                files,
                title:state.prompt
              },
            ]
          : [],
      generationResult: data,
    };
  }

  const response = await llm.invoke(`
The user's primary intent is: ${intent}

User request:
${state.prompt}

Return Markdown only.

Do not generate project files.
Provide a relevant response for the detected intent.

Use appropriate headings when helpful:
# Overview
## Explanation
## Problems
## Improvements
## Best Practices
## Optimized Code (if relevant)
`);

  return {
    ...state,
    aiResponse: extractContent(response.content),
    artifacts: [],
  };
  } catch (error) {
    console.error("[codingAgent] Coding request failed:", error);
      return {
        ...state,
        aiResponse: error?.data?.message || "failed to generate code "
    }
  }
};
