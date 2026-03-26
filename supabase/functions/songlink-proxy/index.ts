import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing url parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiUrl = `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}&userCountry=IN`;
    const response = await fetch(apiUrl);
    const body = await response.text();

    if (!response.ok) {
      let errorMsg = "Could not find this song on Songlink/Odesli";
      if (response.status === 429) {
        errorMsg = "Songlink API rate limit reached. Please wait a minute and try again.";
      } else if (response.status === 404) {
        errorMsg = "Song not found on Songlink/Odesli. Try a different platform URL (e.g. Spotify or Apple Music).";
      }
      console.error(`Odesli API error: status=${response.status}, body=${body}`);
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 200, // Always return 200 to client with error in body
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(body, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Proxy error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
