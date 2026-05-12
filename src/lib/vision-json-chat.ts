type ChatMessage = {
  role: "system" | "user";
  content: unknown;
};

type ChatCompletionResponse = {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
};

/**
 * OpenAI-compatible vision + JSON. Tries Groq first (free tier in many regions), then OpenAI.
 */
export async function completeVisionJson(params: {
  system: string;
  userText: string;
  dataUrl: string;
}): Promise<{ text: string; provider: "openai" | "groq" }> {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();

  const userContent: unknown[] = [
    { type: "text", text: params.userText },
    { type: "image_url", image_url: { url: params.dataUrl } },
  ];

  const messages: ChatMessage[] = [
    { role: "system", content: params.system },
    { role: "user", content: userContent },
  ];

  async function post(
    url: string,
    apiKey: string,
    model: string,
    provider: "openai" | "groq",
  ): Promise<{ text: string; provider: "openai" | "groq" }> {
    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: 1600,
    };
    // Groq often rejects `json_object` on vision routes; OpenAI supports it reliably.
    if (
      provider === "openai" ||
      process.env.GROQ_USE_JSON_OBJECT === "1"
    ) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    let data: ChatCompletionResponse;
    try {
      data = (await response.json()) as ChatCompletionResponse;
    } catch {
      throw new Error(
        `Vision request failed (${response.status}): non-JSON response`,
      );
    }

    if (!response.ok) {
      const err = data as {
        error?: { message?: string } | string;
        message?: string;
      };
      const nested =
        typeof err.error === "object" && err.error?.message
          ? err.error.message
          : typeof err.error === "string"
            ? err.error
            : undefined;
      const msg =
        nested ??
        err.message ??
        `Vision request failed (${response.status})`;
      throw new Error(msg);
    }

    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("Empty response from vision model.");
    }
    return { text, provider };
  }

  if (groqKey) {
    return post(
      "https://api.groq.com/openai/v1/chat/completions",
      groqKey,
      process.env.GROQ_VISION_MODEL?.trim() ||
        "meta-llama/llama-4-scout-17b-16e-instruct",
      "groq",
    );
  }

  if (openaiKey) {
    return post(
      "https://api.openai.com/v1/chat/completions",
      openaiKey,
      process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini",
      "openai",
    );
  }

  throw new Error("NO_VISION_PROVIDER");
}
