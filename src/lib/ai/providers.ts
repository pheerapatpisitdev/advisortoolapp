import type { ChatMessage } from "./types";

export interface CallArgs {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  /** ask the provider for strict JSON where it supports it */
  json?: boolean;
  /** Gemini only: how finely to read pictures and video; "low" for listening to a clip */
  mediaResolution?: "low";
  signal?: AbortSignal;
  /**
   * How hard a Claude model may think before it answers. Sonnet 5 thinks by default when a
   * request says nothing, and the thinking is billed as output and counts against max_tokens —
   * a 500-character post came back costing 1,700 tokens, and longer ones hit the cap mid-JSON.
   * Only Anthropic reads this; the other providers ignore it.
   */
  effort?: "low" | "medium" | "high";
}
export interface CallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

const TIMEOUT_MS = 25_000;

async function postJson(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: signal ?? timeout,
  });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** A message in the OpenAI chat shape: plain text, or text and pictures as data URLs. */
export function openAiMessage(m: ChatMessage): { role: string; content: unknown } {
  if (!m.images?.length) return { role: m.role, content: m.content };
  return {
    role: m.role,
    content: [
      { type: "text", text: m.content },
      ...m.images.map((i) => ({ type: "image_url", image_url: { url: `data:${i.mimeType};base64,${i.base64}` } })),
    ],
  };
}

/** A message in Anthropic's shape: the pictures first, then the words, as its docs advise. */
export function anthropicMessage(m: ChatMessage): { role: string; content: unknown } {
  if (!m.images?.length) return { role: m.role, content: m.content };
  return {
    role: m.role,
    content: [
      ...m.images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.mimeType, data: i.base64 } })),
      { type: "text", text: m.content },
    ],
  };
}

/** A message's parts in Gemini's shape. */
export function googleParts(m: ChatMessage): unknown[] {
  return [
    ...(m.video ? [{ fileData: { mimeType: m.video.mimeType, fileUri: m.video.uri } }] : []),
    ...(m.images ?? []).map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.base64 } })),
    { text: m.content },
  ];
}

/** Splits the system prompt out; Anthropic takes it as its own field. */
function splitSystem(messages: ChatMessage[]) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");
  return { system, rest };
}

export const CALLERS: Record<string, (a: CallArgs) => Promise<CallResult>> = {
  async anthropic({ apiKey, model, messages, maxTokens, signal, effort }) {
    const { system, rest } = splitSystem(messages);
    const data = await postJson("https://api.anthropic.com/v1/messages", {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    }, {
      model, max_tokens: maxTokens,
      // Haiku 4.5 and the 4.5-and-older models reject effort with a 400
      ...(effort && !/haiku|4-5|claude-3/.test(model) ? { output_config: { effort } } : {}),
      ...(system ? { system } : {}),
      messages: rest.map(anthropicMessage),
    }, signal);
    const text = (data.content ?? []).filter((c: { type: string }) => c.type === "text")
      .map((c: { text: string }) => c.text).join("");
    return { text, inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 };
  },

  async openai({ apiKey, model, messages, maxTokens, json, signal, effort }) {
    const data = await postJson("https://api.openai.com/v1/chat/completions", {
      Authorization: `Bearer ${apiKey}`,
    }, {
      model, messages: messages.map(openAiMessage), max_completion_tokens: maxTokens,
      ...(openAiReasoning(model, effort)),
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }, signal);
    return {
      text: data.choices?.[0]?.message?.content ?? "",
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  },

  async google({ apiKey, model, messages, maxTokens, json, signal, mediaResolution }) {
    const { system, rest } = splitSystem(messages);
    const data = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
      {},
      {
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: rest.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: googleParts(m) })),
        generationConfig: {
          maxOutputTokens: maxTokens,
          ...(json ? { responseMimeType: "application/json" } : {}),
          ...(mediaResolution === "low" ? { mediaResolution: "MEDIA_RESOLUTION_LOW" } : {}),
        },
      }, signal);
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    return {
      text,
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  },

  /**
   * Z.ai speaks the OpenAI chat format on its own host.
   *
   * GLM thinks before it answers, and the thinking counts against max_tokens — the GPT-5
   * trouble again. Probed 2026-09-23: at the default, glm-5.3 spent all 200 tokens and
   * answered nothing, glm-5.3-flash got 12 characters out, and a Facebook post from either
   * ran past the 60-second limit. Thinking cannot be switched off ("always engages in
   * thinking… use low, high, or max"); at "low" both answer a Thai question in about eight
   * seconds. Never used until then, so nobody had seen it.
   */
  async zai(args) {
    return openAiCompatible("https://api.z.ai/api/paas/v4/chat/completions", args, { reasoning_effort: "low" });
  },

  /**
   * Typhoon (SCB 10X), a Thai-first model in the OpenAI chat format. Free while the owner's
   * use stays light — 200 requests a minute, no published price — so it is priced 0 and sits
   * at the end of the small tier (owner, 2026-10-10). Its chat model reads no pictures.
   */
  async typhoon(args) {
    return openAiCompatible("https://api.opentyphoon.ai/v1/chat/completions", args);
  },

  /**
   * Kimi (Moonshot), OpenAI chat format, reads pictures.
   *
   * Both models think before they answer and the thinking counts against max_tokens, the
   * GPT-5 trouble of 2026-09-22 again. K2.6 can be told not to; K3 always thinks
   * ("reasoning is always on", default effort "max"), so it is held to "low" unless a caller
   * asks for more.
   */
  async moonshot(args) {
    const extra = /^kimi-k3/.test(args.model)
      ? { reasoning_effort: args.effort ?? "low" }
      : { thinking: { type: "disabled" } };
    return openAiCompatible("https://api.moonshot.ai/v1/chat/completions", args, extra, true);
  },
};

/**
 * How much a GPT-5 model may reason before it answers.
 *
 * GPT-5 models reason by default, and the reasoning is counted against max_completion_tokens.
 * At the chat's caps — 200 to 400 tokens — gpt-5-mini spent every one of them reasoning and
 * answered with nothing: on 2026-09-22, when Gemini was down, 29 of its 31 calls came back at
 * exactly their cap, and customers from the Life Protect advertisement who asked a question
 * were sent the canned request for their age and sex instead of an answer. Probed the next day:
 * default effort, finish "length", empty text, 200 of 200 tokens reasoning; "minimal", a full
 * Thai sentence in 79 tokens, none of them reasoning.
 *
 * So "minimal" unless a caller asks for more; a caller's effort passes through as given.
 */
export function openAiReasoning(model: string, effort?: CallArgs["effort"]): { reasoning_effort?: string } {
  if (!/^gpt-5/.test(model)) return {};
  return { reasoning_effort: effort ?? "minimal" };
}

async function openAiCompatible(url: string, { apiKey, model, messages, maxTokens, json, signal }: CallArgs, extra: Record<string, unknown> = {}, readsPictures = false): Promise<CallResult> {
  const data = await postJson(url, { Authorization: `Bearer ${apiKey}` }, {
    // GLM and Typhoon read no pictures; the words go without them
    model, messages: messages.map((m) => (readsPictures ? openAiMessage(m) : { role: m.role, content: m.content })), max_tokens: maxTokens,
    ...(json ? { response_format: { type: "json_object" } } : {}),
    ...extra,
  }, signal);
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

/**
 * Embeddings. Both options are asked for 1536 dimensions so they share one column and one
 * index; documents embedded by one provider stay searchable if the other takes over later.
 */
export const EMBEDDING_DIMS = 1536;

export interface EmbeddingProvider {
  provider: string;
  model: string;
  usdPerMTok: number;
  embed: (apiKey: string, inputs: string[], signal?: AbortSignal) => Promise<{ vectors: number[][]; tokens: number }>;
}

export const EMBEDDERS: EmbeddingProvider[] = [
  {
    provider: "google",
    model: "gemini-embedding-001",
    usdPerMTok: 0.15,
    async embed(apiKey, inputs, signal) {
      const data = await postJson(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${apiKey}`,
        {},
        {
          requests: inputs.map((text) => ({
            model: "models/gemini-embedding-001",
            content: { parts: [{ text }] },
            outputDimensionality: EMBEDDING_DIMS,
          })),
        }, signal);
      const vectors = (data.embeddings ?? []).map((e: { values: number[] }) => normalise(e.values));
      // Google does not report embedding tokens; approximate for the cost ledger.
      const tokens = Math.ceil(inputs.join(" ").length / 4);
      return { vectors, tokens };
    },
  },
  {
    provider: "openai",
    model: "text-embedding-3-small",
    usdPerMTok: 0.02,
    async embed(apiKey, inputs, signal) {
      const data = await postJson("https://api.openai.com/v1/embeddings", {
        Authorization: `Bearer ${apiKey}`,
      }, { model: "text-embedding-3-small", input: inputs, dimensions: EMBEDDING_DIMS }, signal);
      return {
        vectors: (data.data ?? []).map((d: { embedding: number[] }) => d.embedding),
        tokens: data.usage?.total_tokens ?? 0,
      };
    },
  },
];

/** Gemini returns unnormalised vectors below its native size; cosine search expects unit length. */
function normalise(v: number[]): number[] {
  const len = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return len > 0 ? v.map((x) => x / len) : v;
}

/**
 * TypeSafe's "System One" model, Jev. Not a chat model and not in CALLERS on purpose.
 *
 * It never writes a sentence. It reads a piece of state and a set of typed questions and
 * answers each with a probability — yes/no, one of a list, or a level on a rubric — plus a
 * confidence figure that says how sure it is. That makes it useless for answering a customer
 * and useful for deciding what a message is, which is what `route` spends most of the month
 * doing. Added on 2026-09-22 with nothing wired to it yet: the owner wanted the key in and
 * the tests green first, and the use decided afterwards.
 *
 * Priced on input only — the provider gives output tokens away — so the ledger line for it
 * carries an output count but never an output cost.
 */
export type JudgeQuestion =
  | { type: "noul"; instructions: string; criteria?: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] };

export type JudgeAnswer =
  | { type: "noul"; noul: number }
  | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: "score"; score: number; legend: Record<string, string>; probabilities: Record<string, number>; confidence: number };

export interface JudgeResult {
  /** the version that actually answered — the request names an alias */
  model: string;
  answers: Record<string, JudgeAnswer>;
  inputTokens: number;
  outputTokens: number;
}

export const JUDGE = {
  provider: "typesafe",
  model: "jev-latest",
  usdPerMTokIn: 0.042,
  async ask(apiKey: string, state: unknown, questions: Record<string, JudgeQuestion>, signal?: AbortSignal): Promise<JudgeResult> {
    const data = await postJson("https://api.typesafe.ai/v1/systemone", {
      Authorization: `Bearer ${apiKey}`,
    }, { state, model: JUDGE.model, questions }, signal);
    return {
      model: typeof data.model === "string" && data.model ? data.model : JUDGE.model,
      answers: data.answers ?? {},
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    };
  },
};
