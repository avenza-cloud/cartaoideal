import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createDeepSeek } from "@ai-sdk/deepseek";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { logEvent } from "@/lib/log";

const google = createGoogleGenerativeAI({
  // Accept GEMINI_API_KEY (also the name Google AI Studio hands out); the
  // SDK default is GOOGLE_GENERATIVE_AI_API_KEY, which still works when set.
  apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const deepseek = createDeepSeek({
  baseURL: process.env.DEEPSEEK_BASE_URL,
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

export const chatModel = withFallback(
  google(process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite"),
  deepseek(process.env.DEEPSEEK_MODEL ?? "deepseek-chat")
);
