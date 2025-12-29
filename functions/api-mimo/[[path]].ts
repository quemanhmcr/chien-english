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
        return new Response("Method not allowed", {
            status: 405,
            headers: corsHeaders
        });
    }

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
                ...corsHeaders,
            },
        });
    } catch (error) {
        console.error("Proxy error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders
                }
            }
        );
    }
}
