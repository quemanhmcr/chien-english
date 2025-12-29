interface Env {
    MIMO_API_KEY: string;
}

const MIMO_API_BASE = "https://api.xiaomimimo.com/v1";

interface EventContext {
    request: Request;
    env: Env;
    params: { path?: string[] };
}

export async function onRequest(context: EventContext): Promise<Response> {
    const { request, env, params } = context;

    // Only allow POST requests
    if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
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

        // For streaming responses, pass through directly
        if (request.headers.get("accept")?.includes("text/event-stream") ||
            body.includes('"stream":true')) {
            return new Response(response.body, {
                status: response.status,
                headers: {
                    "Content-Type": response.headers.get("Content-Type") || "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }

        // For regular responses
        const data = await response.text();
        return new Response(data, {
            status: response.status,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch (error) {
        console.error("Proxy error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" }
            }
        );
    }
}
