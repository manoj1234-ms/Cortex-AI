import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenRouter } from "@langchain/openrouter";

const apiKey =process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error("GROQ_API_KEY missing. Check your agent/.env file.");
}

const groq = new ChatGroq({
    model: "openai/gpt-oss-120b",
    apiKey
})

const gemini = new  ChatGoogleGenerativeAI({
    model:"gemini-3.8-flash",
})

const openrouter = new ChatOpenRouter({
    model:"google/gemma-4-26b-a4b-it",
    temperature:0,
    maxOutputTokens:8000
})

export const getModel = (agent) =>{
    switch (agent) {
        case "chat":
            return groq
        case "search":
            return groq
        case "coding":
            return openrouter
        case "ppt":
            return groq
        case "debug":
            return openrouter    
        case "vision":
            return groq  
        case "imageAnalyzer":
            return gemini   

    
        default:
            return groq
    }
}


// liquid/lfm-2.5-2.6b:free
// LFM2.5-2.6B is a compact reasoning model from Liquid AI. It is suited for agent workflows, data extraction, RAG, and long-context processing. Liquid advises against using it for agentic coding or knowledge-heavy tasks.

// Prompts and outputs may be retained and used to train Liquid models.


// NVIDIA: Nemotron 3.5 Super VL (free)
// nvidia/nemotron-3.5-super-vl:free



// Model weights
// Compare
// API
// Try this model
// NVIDIA Nemotron 3.5 Super VL is an open multimodal mixture-of-experts model from NVIDIA, with 12B active parameters out of 120B total. It takes text, images, documents, GUI screenshots, and video as input and returns text, and is built for long-running agents that combine visual understanding with reasoning and tool use.

// It uses a hybrid Mamba-Transformer architecture with multi-token prediction and supports a 1M-token context. Typical uses include document intelligence, web research, coding validation, customer service, and video understanding. Reasoning is on by default and can be turned off or given a token budget.



// XingChen: Xing4.0 29B A4B (free)
// xingchen-agi/xing4.0-29b-a4b:free



// Model weights
// Compare
// API
// Try this model
// Xing4.0-29B-A4B is an open-weight mixture-of-experts language model from China Telecom's AI team (TeleAI) and the successor to the TeleChat series. It has 29B total parameters with 4B active per token and a native 256K-token context window. It was trained entirely on Ascend NPUs with the MindSpore framework and is tuned for complex engineering and agent work: tool calling, multi-step planning, and long-context execution. Reasoning is on by default and can be turned off.