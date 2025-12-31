interface Env {
    MIMO_API_KEY: string;
}

const MIMO_API_BASE = "https://api.xiaomimimo.com/v1";

interface EventContext {
    request: Request;
    env: Env;
    params: { path?: string[] };
}

// CORS headers for all responses
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
};

// Rate limiting tracking (per-worker instance, resets on cold start)
const rateLimitState = {
    requestCount: 0,
    windowStart: Date.now(),
    limit: 100,         // Requests per window
    windowMs: 60000     // 1 minute window
};

function checkRateLimit(): { allowed: boolean; remaining: number; reset: number } {
    const now = Date.now();

    // Reset window if expired
    if (now - rateLimitState.windowStart > rateLimitState.windowMs) {
        rateLimitState.requestCount = 0;
        rateLimitState.windowStart = now;
    }

    const remaining = Math.max(0, rateLimitState.limit - rateLimitState.requestCount);
    const reset = Math.ceil((rateLimitState.windowStart + rateLimitState.windowMs - now) / 1000);

    if (rateLimitState.requestCount >= rateLimitState.limit) {
        return { allowed: false, remaining: 0, reset };
    }

    rateLimitState.requestCount++;
    return { allowed: true, remaining: remaining - 1, reset };
}

function createErrorResponse(
    status: number,
    error: string,
    message: string,
    retryAfter?: string
): Response {
    const body = JSON.stringify({
        error,
        message,
        retryAfter: retryAfter || null,
        timestamp: new Date().toISOString()
    });

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...corsHeaders
    };

    if (retryAfter) {
        headers["Retry-After"] = retryAfter;
    }

    return new Response(body, { status, headers });
}

export async function onRequest(context: EventContext): Promise<Response> {
    const { request, env, params } = context;

    // Handle CORS preflight - return immediately for fastest response
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    // Only allow POST requests
    if (request.method !== "POST") {
        return createErrorResponse(405, "method_not_allowed", "Only POST requests are allowed");
    }

    // Check rate limit
    const rateLimit = checkRateLimit();
    if (!rateLimit.allowed) {
        return createErrorResponse(
            429,
            "rate_limited",
            "Too many requests. Please wait before retrying.",
            rateLimit.reset.toString()
        );
    }

    // Rate limit headers for all responses
    const rateLimitHeaders = {
        "X-RateLimit-Limit": rateLimitState.limit.toString(),
        "X-RateLimit-Remaining": rateLimit.remaining.toString(),
        "X-RateLimit-Reset": rateLimit.reset.toString(),
    };

    // Get the path from params
    const pathSegments = params.path || [];
    const apiPath = pathSegments.join("/");
    const targetUrl = `${MIMO_API_BASE}/${apiPath}`;

    try {
        // Clone the request and add authorization
        const body = await request.text();

        const headers = new Headers({
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.MIMO_API_KEY}`,
            "api-key": env.MIMO_API_KEY,
        });

        const response = await fetch(targetUrl, {
            method: "POST",
            headers,
            body,
        });

        // Handle upstream errors with structured responses
        if (!response.ok) {
            const upstreamRetryAfter = response.headers.get('Retry-After');

            if (response.status === 429) {
                return createErrorResponse(
                    429,
                    "upstream_rate_limited",
                    "AI service is experiencing high demand. Please wait.",
                    upstreamRetryAfter || "60"
                );
            }

            if (response.status === 503 || response.status === 502) {
                return createErrorResponse(
                    503,
                    "service_unavailable",
                    "AI service is temporarily unavailable. Please try again shortly.",
                    "30"
                );
            }
        }

        // Detect streaming request
        const isStreaming = request.headers.get("accept")?.includes("text/event-stream") ||
            body.includes('"stream":true');

        if (isStreaming) {
            // For streaming: pass through body directly with optimized headers
            return new Response(response.body, {
                status: response.status,
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no", // Disable nginx buffering
                    ...rateLimitHeaders,
                    ...corsHeaders,
                },
            });
        }

        // For regular responses
        const data = await response.text();
        return new Response(data, {
            status: response.status,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
                ...rateLimitHeaders,
                ...corsHeaders,
            },
        });
    } catch (error) {
        console.error("Proxy error:", error);
        return createErrorResponse(
            500,
            "internal_error",
            "An unexpected error occurred. Please try again."
        );
    }
}
