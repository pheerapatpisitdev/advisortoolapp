export type Role = "system" | "user" | "assistant";
/** a picture sent with a message, for a model to read — base64 without the data: prefix */
export interface ChatImage {
  base64: string;
  mimeType: string;
}

export interface ChatMessage {
  role: Role;
  content: string;
  /** pictures to read with this message; only user messages carry them */
  images?: ChatImage[];
  /** a video for Gemini to watch and hear — a signed link or a Files API uri; only the google caller reads it */
  video?: { uri: string; mimeType: string };
}

export interface ModelRow {
  id: string;
  provider: string;
  kind: string;
  model_name: string;
  enabled: boolean;
  /** text models are priced per token; image models (kind "image") per picture */
  price: { inputPerMTokUsd: number; outputPerMTokUsd: number; perImageUsd?: number };
  /** provider settings for image models: size, quality, aspect ratio */
  params?: Record<string, unknown> | null;
}

export interface ChatResult {
  text: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costThb: number;
}

/** "small" for parsing and short answers, "large" for reading documents. */
export type Tier = "small" | "large";
