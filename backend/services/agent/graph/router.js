import { getModel } from "../config/llmModels.js";

export const router = async (state) => {
    if (state.file?.mimetype === "application/pdf") {
        return {
            ...state,
            agent: "pdfRag"
        }
    }

    if (state.file?.mimetype?.startsWith("image/")) {
        return {
            ...state,
            agent: "imageAnalyzer"
        }
    }

    if (state.agent && state.agent !== "auto") {
        return {
            ...state,
            agent: state.agent
        }
    }

    const llm = await getModel("router");

    const prompt = `You are an agent router.
    Available agents:
    
    -chat
    -search
    -ppt
    -pdf
    -vision
    -coding
    -debug
    
    Rules:
    
    chat:
    General conversation,
    explations,
    learning,
    question.
    
    search:
    -Questions that need research or current information.
    Note: live web search is not connected; the search agent must say so.

    coding:
    -architecure
    -database design
    -api design
    -Generate new code, websites, applications, or project files.
    -Build a new project.

    pdf:
    Generate a new PDF document from the user's request.

    ppt:
    Requests for presentation outlines or slide content.
    PowerPoint file generation is not connected.

    debug:
    -read the document 
    -see the previous changes
    -read the code 
    -Find and fix a problem in existing code.
    -Analyze errors, logs, test failures, or unexpected behavior.
    -Help verify a code fix.

    vision:
    -Requests to generate images from a text description.
    Uploaded image analysis is handled automatically before this router runs.

    Return exactly one of: chat, search, coding, pdf, ppt, vision, debug.
    Route requests to create new code/projects to coding. Route requests
    about diagnosing or fixing existing code to debug.

    User Query:
    ${state.prompt}
    `

    const response = await llm.invoke(prompt)

    return {
        ...state,
        agent: response.content.trim().toLowerCase()
    }
};
