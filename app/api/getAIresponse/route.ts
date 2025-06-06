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
  try {
    const formData = await request.formData();
    const message = formData.get("message") as string;
    const image = formData.get("image") as File | null;

    if (!message && !image) {
      return NextResponse.json(
        { error: "Message or image is required" },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    let content;
    if (image) {
      // Convert image to base64 for Gemini API
      const bytes = await image.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const imageBase64 = buffer.toString("base64");
      const mimeType = image.type;

      // Generate content with image
      const result = await model.generateContent([
        message ||
          "Analyze this image and provide relevant code examples if applicable",
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
      ]);

      content = result.response.text();
    } else {
      // Text-only response
      const result = await model.generateContent(message);
      content = result.response.text();
    }

    if (!content) {
      throw new Error("No response content received from API");
    }

    return NextResponse.json(await processAIResponse(content));
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
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
