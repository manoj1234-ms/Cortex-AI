
import { getModel } from "../config/llmModels.js";
import { generatePdf } from "../utils/generatePdf.js";
import { uploadTos3 } from "../utils/uploadToS3.js";
import { getFromS3 } from "../utils/getFromS3.js";
import { jsonrepair } from "jsonrepair";
import { deductCredits } from "../utils/deductCredit.js";
import { checkAgentLimit } from "../config/agentLimit.js";

export const pdfAgent = async (state) => {
  try {
    // Validate user prompt
    if (
      typeof state.prompt !== "string" ||
      !state.prompt.trim()
    ) {
      throw new Error("A non-empty prompt is required.");
    }
    await checkAgentLimit(state.userId,"pdf")

    const llm = await getModel("pdf");

    const systemPrompt = `
You are ConvexAI's AI document creator and analysis assistant.

Generate accurate, useful, comprehensive documents based on
the user's request. Support tutorials, reports, notes, essays,
programming guides, and educational documents.

For programming guides, include:
- Fundamentals and important concepts
- Practical explanations and working code examples
- Best practices and common mistakes
- Security, testing, performance, and deployment when relevant
- A conclusion and key takeaways when appropriate

For PHP web development, cover PHP fundamentals, HTML/CSS,
HTTP, forms, validation, sessions, cookies, databases, PDO,
CRUD, authentication, security, APIs, Composer, Laravel,
testing, deployment, performance, and project structure.

OUTPUT FORMAT:
Return ONLY one valid JSON object with these fields:
{
  "title": "Document title",
  "subtitle": "Document subtitle",
  "content": "Complete document content in Markdown"
}

JSON RULES:
- Do not wrap the JSON in Markdown code fences.
- Escape double quotes and backslashes correctly.
- Represent newlines inside JSON strings as \\n.
- Do not add comments or trailing commas.
- Do not omit or truncate the document intentionally.
- Keep the document within your available output-token limit.
- Do not explain how to convert Markdown into PDF.
- Do not fabricate facts.

User request:
${state.prompt}
`;

    // Generate document content
    const response = await llm.invoke(systemPrompt);

    const rawResponse =
      typeof response.content === "string"
        ? response.content.trim()
        : Array.isArray(response.content)
          ? response.content
              .map((item) =>
                typeof item === "string"
                  ? item
                  : item.text ?? ""
              )
              .join("")
              .trim()
          : "";

    if (!rawResponse) {
      throw new Error("The model returned an empty response.");
    }

    await deductCredits(state.userId, "pdf")

    // Remove optional Markdown JSON fences
    const cleanedResponse = rawResponse
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    // Parse JSON, repairing common formatting mistakes if needed
    let data;

    try {
      data = JSON.parse(cleanedResponse);
    } catch {
      try {
        data = JSON.parse(jsonrepair(cleanedResponse));
      } catch (repairError) {
        console.error(
          "[pdfAgent] JSON parsing failed:",
          repairError.message
        );

        console.error(
          "[pdfAgent] Response preview:",
          cleanedResponse.slice(-1500)
        );

        throw new Error(
          "The model returned invalid or incomplete JSON. Try a shorter document or increase the model output-token limit."
        );
      }
    }

    // Validate document structure
    if (
      !data ||
      typeof data.title !== "string" ||
      typeof data.content !== "string" ||
      !data.content.trim()
    ) {
      throw new Error(
        "The model response must contain a title and non-empty content."
      );
    }

    const documentData = {
      title: data.title.trim(),
      subtitle:
        typeof data.subtitle === "string" &&
        data.subtitle.trim()
          ? data.subtitle.trim()
          : "Created with ConvexAI",
      content: data.content.trim(),
    };

    // Generate PDF buffer
    const pdfBuffer = await generatePdf(documentData);

    if (
      !Buffer.isBuffer(pdfBuffer) ||
      pdfBuffer.length === 0
    ) {
      throw new Error("PDF generation returned an empty buffer.");
    }

    // Upload PDF to S3
    const filename = `pdf-${Date.now()}.pdf`;

    await uploadTos3(
      filename,
      pdfBuffer,
      "application/pdf"
    );

    // Generate a signed URL valid for 10 minutes
    const downloadUrl = await getFromS3(filename, 600);

    if (
      typeof downloadUrl !== "string" ||
      !downloadUrl.trim()
    ) {
      throw new Error(
        "Failed to generate the PDF download URL."
      );
    }

    // Return structured JSON for the frontend
    return {
      ...state,
      aiResponse: `# ${documentData.title}

${documentData.subtitle}

[Download PDF](${downloadUrl})

Link expires in 10 minutes.

---

${documentData.content}`,
      error: null,
    };
  } catch (error) {
    console.error("[pdfAgent] Error:", error);

      return {
        ...state,
        aiResponse: error?.data?.message || "failed to generate pdf"  
    }

  }
};
