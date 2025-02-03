import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.together.xyz/v1",
});

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
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured");
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

    const messages = [
      SYSTEM_MESSAGE,
      ...(context || []),
      {
        role: "user" as const,
        content: message,
      },
    ];

    const response = await openai.chat.completions.create({
      model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
      messages,
      max_tokens: 4096,
      temperature: 0.4,
      top_p: 0.2,
      frequency_penalty: 0.5,
      presence_penalty: 0.5,
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error("No response content received from API");
    }

    return NextResponse.json(
      await processAIResponse(response.choices[0].message.content)
    );
  });
}

export async function GET() {
  return handleAIRequest(async () => {
    const response = await openai.chat.completions.create({
      model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
      messages: [
        SYSTEM_MESSAGE,
        {
          role: "user",
          content:
            "Generate examples of clean code following best practices in multiple programming languages.",
        },
      ],
      max_tokens: 4096,
      temperature: 0.4,
      top_p: 0.2,
      frequency_penalty: 0.5,
      presence_penalty: 0.5,
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error("No response content received from API");
    }

    return NextResponse.json(
      await processAIResponse(response.choices[0].message.content)
    );
  });
}
