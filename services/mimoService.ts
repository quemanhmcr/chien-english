import { EvaluationResult, Lesson, AnalysisToken } from "../types";
import { TRANSLATION_EVAL_PROMPT, ROLE_PLAY_EVAL_PROMPT, DETECTIVE_EVAL_PROMPT, LESSON_GENERATION_PROMPT } from "./prompts";

// API key is now handled server-side via Cloudflare Function
// All requests go through the proxy - works in both dev and production
const BASE_URL = "/api-mimo/chat/completions";
const MODEL = "mimo-v2-flash";

// ============================================================================
// CIRCUIT BREAKER PATTERN
// Prevents cascading failures when the AI API is experiencing issues
// ============================================================================
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
  successesSinceHalfOpen: number;
}

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
  successesSinceHalfOpen: 0
};

const CIRCUIT_CONFIG = {
  FAILURE_THRESHOLD: 5,      // Open circuit after 5 consecutive failures
  RESET_TIMEOUT: 60000,      // Try again after 1 minute
  SUCCESS_THRESHOLD: 2,      // Close circuit after 2 consecutive successes in half-open
  HALF_OPEN_MAX_REQUESTS: 3  // Max concurrent requests in half-open state
};

/**
 * Check if circuit breaker allows the request
 */
function canMakeRequest(): boolean {
  const now = Date.now();

  if (!circuitBreaker.isOpen) {
    return true;
  }

  // Check if we should try half-open state
  if (now - circuitBreaker.lastFailure >= CIRCUIT_CONFIG.RESET_TIMEOUT) {
    // Enter half-open state - allow limited requests
    return true;
  }

  return false;
}

/**
 * Record a successful request
 */
function recordSuccess(): void {
  if (circuitBreaker.isOpen) {
    circuitBreaker.successesSinceHalfOpen++;
    if (circuitBreaker.successesSinceHalfOpen >= CIRCUIT_CONFIG.SUCCESS_THRESHOLD) {
      // Close the circuit - service is healthy again
      circuitBreaker.isOpen = false;
      circuitBreaker.failures = 0;
      circuitBreaker.successesSinceHalfOpen = 0;
      if (import.meta.env.DEV) {
        console.log('[CircuitBreaker] Circuit CLOSED - service recovered');
      }
    }
  } else {
    circuitBreaker.failures = 0;
  }
}

/**
 * Record a failed request
 */
function recordFailure(): void {
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();
  circuitBreaker.successesSinceHalfOpen = 0;

  if (circuitBreaker.failures >= CIRCUIT_CONFIG.FAILURE_THRESHOLD) {
    circuitBreaker.isOpen = true;
    if (import.meta.env.DEV) {
      console.warn('[CircuitBreaker] Circuit OPEN - too many failures');
    }
  }
}

// ============================================================================
// REQUEST COALESCING
// Prevents duplicate identical requests from being sent simultaneously
// ============================================================================
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Generate a cache key for request deduplication
 */
function generateRequestKey(messages: any[]): string {
  return JSON.stringify(messages.slice(-2)); // Use last 2 messages for key
}

// ============================================================================
// RETRY LOGIC WITH JITTER
// Prevents thundering herd problem when service recovers
// ============================================================================
function getRetryDelay(attempt: number): number {
  // Exponential backoff: 1s, 2s, 4s with random jitter up to 1s
  const baseDelay = Math.pow(2, attempt - 1) * 1000;
  const jitter = Math.random() * 1000;
  return Math.min(baseDelay + jitter, 30000); // Cap at 30 seconds
}

/**
 * Field mapping for token optimization.
 * Maps compressed keys to original EvaluationResult keys.
 */
const EVAL_MAPPING: Record<string, keyof EvaluationResult | string> = {
  da: 'detailedAnalysis',
  sc: 'score',
  co: 'correction',
  ex: 'explanation',
  kt: 'keyTakeaway',
  iv: 'improvedVersion',
  gp: 'grammarPoints',
  cn: 'coachNote',
  ip: 'isPass',
  rpm: 'rolePlayMetrics',
  tt: 'toneType',
  tv: 'toneValue',
  // Role-play specific
  ms: 'modelSentence',
  sp: 'suggestionPhrases',
  // Detective specific
  og: 'originalError',
  uc: 'userCaughtError',
  vd: 'verdict'
};

const RPM_MAPPING: Record<string, string> = {
  ta: 'taskAchievement',
  cc: 'coherence',
  lr: 'lexicalResource',
  ga: 'grammar'
};

const TOKEN_MAPPING: Record<string, keyof AnalysisToken> = {
  t: 'text',
  s: 'status',
  c: 'correction',
  et: 'errorType',
  e: 'explanation',
  r: 'explanation'  // 'r' (reason) in prompt maps to 'explanation' in UI
};

const STATUS_MAPPING: Record<string, AnalysisToken['status']> = {
  ok: 'correct',
  err: 'error',
  mis: 'missing',
  ext: 'extra'
};

/**
 * Maps a compressed AI response back to the standard EvaluationResult format.
 */
function mapResponse(data: any): EvaluationResult {
  const result: any = {};

  // Map top-level fields
  Object.keys(data).forEach(key => {
    const mappedKey = EVAL_MAPPING[key] || key;
    result[mappedKey] = data[key];
  });

  // Map detailedAnalysis
  if (data.da && Array.isArray(data.da)) {
    result.detailedAnalysis = data.da.map((item: any) => {
      if (!item || typeof item !== 'object') return null; // Guard against non-object items
      const mappedItem: any = {};
      Object.keys(item).forEach(k => {
        const mappedK = TOKEN_MAPPING[k] || k;
        let value = item[k];
        if (mappedK === 'status') {
          value = STATUS_MAPPING[value] || value;
        }
        mappedItem[mappedK] = value;
      });
      return mappedItem;
    }).filter(Boolean); // Remove nulls
  } else {
    result.detailedAnalysis = [];
  }

  // Map rolePlayMetrics
  if (data.rpm && typeof data.rpm === 'object') {
    result.rolePlayMetrics = {};
    Object.keys(data.rpm).forEach(k => {
      const mappedK = RPM_MAPPING[k] || k;
      result.rolePlayMetrics[mappedK] = data.rpm[k];
    });
  }

  return result as EvaluationResult;
}

/**
 * A robust helper to parse incomplete JSON strings during streaming.
 * Updated to handle compressed keys.
 */
function partialParseJson(jsonString: string): any {
  const raw: any = {
    da: [],
    sc: 0,
    co: "",
    ex: "",
    kt: "",
    iv: "",
    cn: "",
    gp: []
  };

  try {
    const parsed = JSON.parse(jsonString);
    return mapResponse(parsed);
  } catch (e) {
    // Best-effort extraction for top-level fields (using short keys)
    const fields = ['sc', 'co', 'ex', 'ip', 'iv', 'kt', 'cn'];
    fields.forEach(field => {
      const regex = new RegExp(`"${field}"\\s*:\\s*(?:(\\d+)|"(.*?)")`, 'g');
      const match = regex.exec(jsonString);
      if (match) {
        raw[field] = match[1] ? parseInt(match[1]) : match[2];
      }
    });

    // Extraction for rolePlayMetrics (short key "rpm")
    const rpmIdx = jsonString.indexOf('"rpm"');
    if (rpmIdx !== -1) {
      const rpmContent = jsonString.substring(rpmIdx);
      const metrics = ['ta', 'cc', 'lr', 'ga']; // Goal Achievement, Coherence, Lexical, Grammar
      raw.rpm = {};
      metrics.forEach(m => {
        const mRegex = new RegExp(`"${m}"\\s*:\\s*(\\d+)`, 'g');
        const mMatch = mRegex.exec(rpmContent);
        if (mMatch) {
          raw.rpm[m] = parseInt(mMatch[1]);
        }
      });
    }

    // Extraction for detailedAnalysis (short key "da")
    const daIdx = jsonString.lastIndexOf('"da"'); // Use lastIndexOf to handle potential partial duplicates
    if (daIdx !== -1) {
      const daContent = jsonString.substring(daIdx);
      // More flexible object regex to handle nested or trailing chars better during streaming
      const objectRegex = /\{[^{}]*?"t"[^{}]*?\}/g;
      const matches = [...daContent.matchAll(objectRegex)];

      const partialArray: any[] = [];
      matches.forEach(m => {
        try {
          const obj = JSON.parse(m[0]);
          if (obj.t) partialArray.push(obj);
        } catch (innerE) {
          // Manual extraction for semi-formed objects
          const tM = m[0].match(/"t"\s*:\s*"(.*?)"/);
          const sM = m[0].match(/"s"\s*:\s*"(.*?)"/);
          const cM = m[0].match(/"c"\s*:\s*"(.*?)"/);
          const etM = m[0].match(/"et"\s*:\s*"(.*?)"/);

          if (tM) {
            partialArray.push({
              t: tM[1],
              s: sM ? sM[1] : 'ok',
              c: cM ? cM[1] : undefined,
              et: etM ? etM[1] : undefined
            });
          }
        }
      });
      if (partialArray.length > 0) raw.da = partialArray;
    }

    // Grammar points (short key "gp")
    const gpStart = jsonString.indexOf('"gp"');
    if (gpStart !== -1) {
      const content = jsonString.substring(gpStart);
      const items = [...content.matchAll(/"([^"]+)"/g)].map(m => m[1]).filter(s => s !== "gp" && s !== ":");
      if (items.length > 0) raw.gp = items;
    }

    return mapResponse(raw);
  }
}

async function fetchStreamingMiMo(messages: any[], onUpdate: (partialData: any) => void) {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response body is null");

  const decoder = new TextDecoder();
  let fullContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith("data: ")) {
        const dataStr = trimmedLine.replace("data: ", "").trim();
        if (dataStr === "[DONE]") break;

        try {
          const data = JSON.parse(dataStr);
          const content = data.choices[0]?.delta?.content || "";
          fullContent += content;

          const partialJson = partialParseJson(fullContent);
          onUpdate(partialJson);
        } catch (e) {
          // Ignore
        }
      }
    }
  }

  return partialParseJson(fullContent);
}

async function fetchMiMo(messages: any[], responseFormat?: any, retries = 3): Promise<any> {
  // Circuit breaker check
  if (!canMakeRequest()) {
    throw new Error("Máy chủ AI đang gặp sự cố. Vui lòng thử lại sau 1 phút.");
  }

  // Request coalescing - check for identical pending request
  const requestKey = generateRequestKey(messages);
  const existingRequest = pendingRequests.get(requestKey);
  if (existingRequest) {
    if (import.meta.env.DEV) {
      console.log('[MiMo] Coalescing duplicate request');
    }
    return existingRequest;
  }

  const TIMEOUT_MS = 30000; // 30 seconds timeout
  let lastError: Error | null = null;

  const executeRequest = async (): Promise<any> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(BASE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            messages,
            response_format: responseFormat,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          // Handle specific error codes
          if (response.status === 429) {
            recordFailure();
            throw new Error("Quá nhiều yêu cầu. Vui lòng đợi một chút và thử lại.");
          } else if (response.status === 503 || response.status === 502) {
            recordFailure();
            throw new Error("Máy chủ AI đang bận. Đang thử lại...");
          } else {
            throw new Error(errorData.message || `Lỗi kết nối: ${response.status}`);
          }
        }

        // Success - record it and return
        recordSuccess();
        return await response.json();
      } catch (error: any) {
        lastError = error;

        // Don't retry on abort (user cancelled) or client errors
        if (error.name === 'AbortError') {
          recordFailure();
          throw new Error("Kết nối quá lâu. Vui lòng kiểm tra mạng và thử lại.");
        }

        // Log retry attempt (only in development)
        if (import.meta.env.DEV) {
          console.warn(`[MiMo API] Attempt ${attempt}/${retries} failed:`, error.message);
        }

        // Record failure for circuit breaker
        recordFailure();

        // Wait before retry with jitter
        if (attempt < retries) {
          const delay = getRetryDelay(attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    throw lastError || new Error("Không thể kết nối máy chủ AI. Vui lòng thử lại sau.");
  };

  // Store the promise for coalescing
  const requestPromise = executeRequest().finally(() => {
    // Clean up pending request after completion
    pendingRequests.delete(requestKey);
  });

  pendingRequests.set(requestKey, requestPromise);
  return requestPromise;
}

/**
 * Evaluates an exercise based on its type (translation or roleplay).
 */
export const evaluateExercise = async (
  vietnamese: string, // Situations or goal for context
  userEnglish: string,
  type: 'translation' | 'roleplay' | 'detective' = 'translation',
  onUpdate?: (partial: EvaluationResult) => void
): Promise<EvaluationResult> => {
  // Normalize type to lowercase for case-insensitive matching
  const normalizedType = (type || '').toLowerCase() as 'translation' | 'roleplay' | 'detective';

  try {
    const systemPrompt = normalizedType === 'roleplay'
      ? ROLE_PLAY_EVAL_PROMPT
      : normalizedType === 'detective'
        ? DETECTIVE_EVAL_PROMPT
        : TRANSLATION_EVAL_PROMPT;

    const userPrompt = normalizedType === 'roleplay'
      ? `Goal/Situation: "${vietnamese}"\nLearner's response: "${userEnglish}"`
      : normalizedType === 'detective'
        ? `Incorrect Sentence: "${vietnamese}"\nLearner's Corrected Version: "${userEnglish}"`
        : `VN: "${vietnamese}"\nEN: "${userEnglish}"`;

    if (onUpdate) {
      return await fetchStreamingMiMo([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ], (data) => onUpdate(data as EvaluationResult));
    }

    const data = await fetchMiMo([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], { type: "json_object" });

    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);
    return mapResponse(parsed);

  } catch (error) {
    console.error(`Error evaluating ${type} exercise:`, error);
    return {
      score: 0,
      correction: "Error connecting to AI.",
      explanation: "Có lỗi xảy ra khi kết nối với máy chủ.",
      isPass: false,
      detailedAnalysis: [{ text: userEnglish, status: 'error', correction: 'Error' } as any],
      keyTakeaway: "Kiểm tra kết nối mạng."
    } as EvaluationResult;
  }
};

/** Backward compatibility alias */
export const evaluateTranslation = evaluateExercise;

export const generateLessonContent = async (topicDescription: string, questionCount: number | 'auto' = 10): Promise<Omit<Lesson, 'id'>> => {
  let quantityInstruction = "";
  if (questionCount === 'auto') {
    quantityInstruction = "Generate an optimal number of exercises (between 8 and 15) based on the depth of the topic.";
  } else {
    quantityInstruction = `Generate exactly ${questionCount} exercises.`;
  }

  const systemPrompt = LESSON_GENERATION_PROMPT;
  const userPrompt = `Topic: "${topicDescription}". ${quantityInstruction}`;

  const data = await fetchMiMo([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], { type: "json_object" });

  const content = data.choices[0].message.content;
  return JSON.parse(content) as Omit<Lesson, 'id'>;
};

