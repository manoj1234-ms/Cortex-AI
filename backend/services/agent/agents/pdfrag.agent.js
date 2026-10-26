import { readFile, rm } from "node:fs/promises";
import {PDFParse} from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { vectorStore } from '../config/vectordb.js';
import { getModel } from '../config/llmModels.js';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { deductCredits } from "../utils/deductCredit.js";
import { checkAgentLimit } from "../config/agentLimit.js";

export const pdfRag = async(state) => {
    if (!state.file?.path) {
        throw new Error("Upload a PDF before asking a question.");
    }

    let parser;
    try {
        await checkAgentLimit(state.userId,"pdf")
        const buffer = await readFile(state.file.path);
        parser = new PDFParse({ data: buffer });
        const { text } = await parser.getText();

        if (!text.trim()) {
            throw new Error("No readable text was found in the uploaded PDF.");
        }

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 150
        });
        const docs = await splitter.createDocuments([text]);
        const collectionName = `pdf-${Date.now()}`;
        const store = await vectorStore(docs, collectionName);
        const relevantDocs = await store.similaritySearch(state.prompt, 5);
        const context = relevantDocs.map(doc => doc.pageContent).join("\n\n");

        const llm = await getModel("pdf-rag");
        const response = await llm.invoke([
            new SystemMessage(`You are ConvexAI's PDF assistant.
Answer only from the uploaded PDF context. Do not make up information.
If the answer is not in the context, say: "I couldn't find this information in the uploaded PDF."
Use Markdown when helpful.`),
            new HumanMessage(`PDF context:\n${context}\n\nQuestion: ${state.prompt}`)
        ]);

        const answer = typeof response.content === "string"
            ? response.content
            : response.content
                .filter(part => part.type === "text")
                .map(part => part.text)
                .join("");

        if (!answer.trim()) {
            throw new Error("The PDF assistant returned an empty response.");
        }

        await deductCredits(state.userId, "pdf");
        return {
            ...state,
            aiResponse: answer
        };
    } catch (error) {
        console.error("[pdfRag] PDF analysis failed:", error);
         return {
        ...state,
        aiResponse: error?.data?.message || "failed to analyze the uploaded pdf"
    }
    } finally {
        if (parser) {
            await parser.destroy();
        }
        await rm(state.file.path, { force: true });
    }
}
