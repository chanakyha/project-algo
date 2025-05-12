import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

console.log(process.env.GEMINI_API_KEY);

const SYSTEM_MESSAGE = {
  role: "system" as const,
  content:
    "You are an expert programming assistant proficient in all programming languages. For each code example, please specify the language and provide clear explanations. Format your response with '```language' at the start of each code block.",
};

async function extractCodeBlocks(content: string) {
  const codeBlockRegex = /```(\w+)?\s*([\s\S]*?)```/g;
  const codeBlocks = [];
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    codeBlocks.push({
      language: match[1] || "text",
      code: match[2].trim(),
    });
  }

  // Remove code blocks from content to get explanation
  const explanation = content.replace(codeBlockRegex, "").trim();

  return {
    message: content,
    codeBlocks,
    explanation,
  };
}

async function processAIResponse(content: string) {
  return extractCodeBlocks(content);
}

async function handleAIRequest<T>(
  action: () => Promise<T>
): Promise<T | NextResponse> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key is not configured");
    }
    return await action();
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      {
        error: "Failed to get AI response",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return handleAIRequest(async () => {
    const { message, context } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Combine context and message
    const fullPrompt = [
      SYSTEM_MESSAGE.content,
      ...(context || []).map(
        (msg: { role: string; content: string }) => msg.content
      ),
      message,
    ].join("\n\n");
    console.log(fullPrompt);

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const content = response.text();

    if (!content) {
      throw new Error("No response content received from API");
    }

    return NextResponse.json(await processAIResponse(content));
  });
}

export async function GET() {
  return handleAIRequest(async () => {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = [
      SYSTEM_MESSAGE.content,
      "Generate examples of clean code following best practices in multiple programming languages.",
    ].join("\n\n");

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    if (!content) {
      throw new Error("No response content received from API");
    }

    return NextResponse.json(await processAIResponse(content));
  });
}
