import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createDeepSeek } from "@ai-sdk/deepseek";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { logEvent } from "@/lib/log";

const OPENCODE_DEFAULT_BASE_URL = "https://opencode.ai/zen/go/v1";

const openCodeApiKey = process.env.OPENCODE_API_KEY ?? process.env.DEEPSEEK_API_KEY;
const openCodeBaseUrl =
  process.env.OPENCODE_BASE_URL ?? process.env.DEEPSEEK_BASE_URL ?? OPENCODE_DEFAULT_BASE_URL;

const opencode = createDeepSeek({
  apiKey: openCodeApiKey,
  baseURL: openCodeBaseUrl,
  headers: {
    // Required by OpenCode Go gateway for session routing & prompt caching.
    "x-opencode-session": process.env.OPENCODE_SESSION_ID ?? "sess_cartaoideal_prod",
  },
});

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

/**
 * Try the primary model; if its request fails to start (bad key, quota,
 * outage), retry the whole call on the fallback. Mid-stream errors are not
 * retried — by then partial output has already reached the client.
 */
function withFallback(primary: LanguageModelV3, fallback: LanguageModelV3): LanguageModelV3 {
  const failover = (error: unknown) => {
    logEvent("ai-fallback", {
      from: `${primary.provider}/${primary.modelId}`,
      to: `${fallback.provider}/${fallback.modelId}`,
      error: error instanceof Error ? error.name : "unknown",
    });
  };
  return {
    specificationVersion: "v3",
    provider: primary.provider,
    modelId: primary.modelId,
    get supportedUrls() {
      return primary.supportedUrls;
    },
    async doGenerate(options) {
      try {
        return await primary.doGenerate(options);
      } catch (error) {
        failover(error);
        return fallback.doGenerate(options);
      }
    },
    async doStream(options) {
      try {
        return await primary.doStream(options);
      } catch (error) {
        failover(error);
        return fallback.doStream(options);
      }
    },
  };
}

const primaryModelId =
  process.env.OPENCODE_MODEL ?? process.env.DEEPSEEK_MODEL ?? "deepseek-v4.1-flash";
const fallbackModelId = process.env.OPENCODE_FALLBACK_MODEL ?? "glm-5.3-flash";

export const chatModel = openCodeApiKey
  ? withFallback(opencode(primaryModelId), opencode(fallbackModelId))
  : withFallback(
      google(process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite"),
      opencode(primaryModelId)
    );
