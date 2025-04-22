import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

console.log("🚀 HLS Proxy running on Deno Deploy");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

serve(async (req) => {
  const { pathname } = new URL(req.url);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (pathname.startsWith("/proxy/")) {
    const targetUrl = decodeURIComponent(pathname.replace("/proxy/", ""));

    try {
      const res = await fetch(targetUrl, {
        headers: {
          // Optional: spoof headers to avoid blocking
          "User-Agent": "Mozilla/5.0",
          "Referer": targetUrl,
        },
      });

      if (!res.ok) {
        return new Response("Failed to fetch stream", { status: res.status, headers: corsHeaders });
      }

      const contentType = res.headers.get("Content-Type") ?? "application/octet-stream";

      return new Response(res.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
        },
      });

    } catch (err) {
      console.error("Proxy error:", err);
      return new Response("Proxy error", { status: 500, headers: corsHeaders });
    }
  }

  return new Response("Not Found", { status: 404 });
});
