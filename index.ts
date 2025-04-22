import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

console.log("Server running on Deno Deploy...");

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const keyword = url.searchParams.get("q") || "";
  const id = url.searchParams.get("id") || "";
  const streamUrl = url.searchParams.get("url") || "";

  if (path === "/") {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Gojo API Docs</title>
        <style>
          body { font-family: sans-serif; padding: 2rem; line-height: 1.6; background: #f9f9f9; }
          code { background: #eee; padding: 2px 5px; border-radius: 4px; }
          h1 { color: #333; }
        </style>
      </head>
      <body>
        <h1>🔍 Gojo Anime API</h1>
        <p>Welcome to the public API for Gojo anime search and streaming. Below are the available endpoints:</p>

        <h2>📘 Endpoints</h2>

        <h3>1. Search Anime</h3>
        <p><code>GET /api/search?q=naruto</code></p>
        <p>Returns a list of anime search results.</p>

        <h3>2. Get Anime Details</h3>
        <p><code>GET /api/details?id=12345</code></p>
        <p>Fetch details about a specific anime.</p>

        <h3>3. Get Episodes</h3>
        <p><code>GET /api/episodes?id=12345</code></p>
        <p>List episodes with IDs across providers (pahe, zaza, strix).</p>

        <h3>4. Get Stream URLs</h3>
        <p><code>GET /api/stream?url=animeId/provider1/epNum/epId1/provider2/epNum/epId2</code></p>
        <p>Returns streaming URLs for each provider with quality options.</p>

        <h3>5. Recent Anime</h3>
        <p><code>GET /api/recent?page=1</code></p>
        <p>Returns a list of the latest released anime episodes.</p>

        <h2>🔧 Example</h2>
        <p>Search Naruto: <code>/api/search?q=naruto</code></p>
        <p>Example Stream URL: <code>/api/stream?url=12345/pahe/1/abc/zaza/1/xyz/strix/1/def</code></p>

        <footer style="margin-top: 2rem; font-size: 0.9rem;">
          Built with ❤️ using Deno Deploy
        </footer>
      </body>
      </html>
    `;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (path === "/api/recent") {
    const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
    const result = await getRecentAnime(pageParam);
    return new Response(result, { headers: { "Content-Type": "application/json" } });
  }

  if (path === "/api/search") {
    const result = await searchResults(keyword);
    return new Response(result, { headers: { "Content-Type": "application/json" } });
  }

  if (path === "/api/details") {
    const result = await extractDetails(id);
    return new Response(result, { headers: { "Content-Type": "application/json" } });
  }

  if (path === "/api/episodes") {
    const result = await extractEpisodes(id);
    return new Response(result, { headers: { "Content-Type": "application/json" } });
  }

  if (path === "/api/stream") {
    const result = await extractStreamUrl(streamUrl);
    return new Response(result, { headers: { "Content-Type": "application/json" } });
  }

  return new Response("Not found", { status: 404 });
});

async function getRecentAnime(page = 1) {
  const headers = {
    "Referer": "https://gojo.wtf/",
    "User-Agent": "Mozilla/5.0"
  };

  const url = `https://backend.gojo.wtf/api/anime/recent?type=anime&page=${page}&perPage=12`;

  const response = await fetchv2(url, headers);

  // Just pass through the original JSON
  return await response.text(); // or `.json()` if you want to parse/modify
}


// Utility Functions (same as your script but with native fetch)

async function fetchv2(url: string, headers: Record<string, string>) {
  return await fetch(url, { headers });
}

async function searchResults(keyword: string) {
  const results = [];
  const headers = {
    "Referer": "https://gojo.wtf/",
    "User-Agent": "Mozilla/5.0"
  };

  const encodedKeyword = encodeURIComponent(keyword);
  const response = await fetchv2(`https://backend.gojo.wtf/api/anime/search?query=${encodedKeyword}&page=1`, headers);
  const json = await response.json();

  json.results.forEach((anime: any) => {
    const title = anime.title.english || anime.title.romaji || anime.title.native || "Unknown Title";
    const image = anime.coverImage.large;
    const href = `${anime.id}`;

    if (title && href && image) {
      results.push({ title, image, href });
    }
  });

  return JSON.stringify(results);
}

async function extractDetails(id: string) {
  const headers = {
    "Referer": "https://gojo.wtf/",
    "User-Agent": "Mozilla/5.0"
  };

  const response = await fetchv2(`https://backend.gojo.wtf/api/anime/info/${id}`, headers);
  const json = await response.json();
  const description = cleanHtmlSymbols(json.description) || "No description available";

  return JSON.stringify([{ description: description.replace(/<br>/g, ""), aliases: "N/A", airdate: "N/A" }]);
}

async function extractEpisodes(id: string) {
  const headers = {
    "Referer": "https://gojo.wtf/",
    "User-Agent": "Mozilla/5.0"
  };

  const response = await fetchv2(`https://backend.gojo.wtf/api/anime/episodes/${id}`, headers);
  const json = await response.json();

  const providers = ["pahe", "zaza", "strix"];
  const episodesMap: Record<string, any[]> = {};

  providers.forEach((provider) => {
    const providerData = json.find((p: any) => p.providerId === provider);
    episodesMap[provider] = providerData?.episodes || [];
  });

  const results = [];

  for (let i = 0; i < episodesMap["pahe"].length; i++) {
    const pahe = episodesMap["pahe"][i];
    const zaza = episodesMap["zaza"][i];
    const strix = episodesMap["strix"][i];

    if (pahe && zaza && strix) {
      results.push({
        href: `${id}/pahe/${pahe.number}/${pahe.id}/zaza/${zaza.number}/${zaza.id}/strix/${strix.number}/${strix.id}`,
        number: pahe.number
      });
    }
  }

  return JSON.stringify(results);
}

async function extractStreamUrl(url: string) {
  const parts = url.split("/");
  const id = parts[0];
  const rest = parts.slice(1);

  const providers = [];
  for (let i = 0; i < rest.length; i += 3) {
    const [provider, number, episodeId] = rest.slice(i, i + 3);
    providers.push({ provider, number, episodeId });
  }

  const headers = {
    "Referer": "https://gojo.wtf/",
    "User-Agent": "Mozilla/5.0"
  };

  const fetches = providers.map(({ provider, number, episodeId }) =>
    fetchv2(
      `https://backend.gojo.wtf/api/anime/tiddies?provider=${provider}&id=${id}&num=${number}&subType=sub&watchId=${episodeId}&dub_id=null`,
      headers
    )
      .then((res) => res.json())
      .then((json) => json.sources.map((src: any) => ({ provider, quality: src.quality, url: src.url })))
  );

  const allSources = (await Promise.all(fetches)).flat();

  const streams = allSources.map(({ provider, quality, url }) => ({
    label: `${provider} - ${quality}`,
    url
  }));

  return JSON.stringify({ streams });
}

function cleanHtmlSymbols(str: string) {
  return str
    ?.replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/&#[0-9]+;/g, "")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .replace(/<i[^>]*>(.*?)<\/i>/g, "$1")
    .replace(/<b[^>]*>(.*?)<\/b>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}
