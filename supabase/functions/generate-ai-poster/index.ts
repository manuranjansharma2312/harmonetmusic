import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getApiKey(): Promise<string> {
  // Check for custom API key stored by admin in ai_settings
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceRoleKey) {
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data } = await supabase.from("ai_settings").select("custom_api_key").limit(1).maybeSingle();
      if (data?.custom_api_key && data.custom_api_key.trim().length > 0) {
        return data.custom_api_key.trim();
      }
    }
  } catch (e) {
    console.error("Failed to fetch custom API key from DB, using env fallback:", e);
  }

  // Fallback to environment variable
  const envKey = Deno.env.get("LOVABLE_API_KEY");
  if (!envKey) throw new Error("No API key configured. Set one in Admin Settings or configure LOVABLE_API_KEY.");
  return envKey;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, aspectRatio, referenceImage } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = await getApiKey();

    // Build prompt with aspect ratio instruction
    let fullPrompt = prompt.trim();
    if (aspectRatio) {
      fullPrompt += ` Generate the image in ${aspectRatio} aspect ratio.`;
    }

    // Build message content - text only or multimodal with reference image
    let messageContent: unknown;
    if (referenceImage && typeof referenceImage === "string") {
      messageContent = [
        { type: "text", text: `Use this reference image as style/design inspiration. ${fullPrompt}` },
        { type: "image_url", image_url: { url: referenceImage } },
      ];
    } else {
      messageContent = fullPrompt;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    let response: Response;
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image-preview",
          messages: [
            {
              role: "user",
              content: messageContent,
            },
          ],
          modalities: ["image", "text"],
        }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeout);
      if (e instanceof DOMException && e.name === "AbortError") {
        return new Response(JSON.stringify({ error: "Image generation timed out. Please try a simpler prompt." }), {
          status: 504,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }
    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact admin." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Image generation failed. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // Extract image from response — multiple fallback paths
    let imageUrl: string | undefined;

    // Path 1: Standard images array
    const images = data.choices?.[0]?.message?.images;
    if (Array.isArray(images) && images.length > 0) {
      imageUrl = images[0]?.image_url?.url;
    }

    // Path 2: Check content for inline base64
    if (!imageUrl) {
      const content = data.choices?.[0]?.message?.content;
      if (typeof content === "string") {
        const match = content.match(/(data:image\/[^;]+;base64,[A-Za-z0-9+/=\s]+)/);
        if (match) imageUrl = match[1].replace(/\s/g, "");
      }
      // Path 3: Content array with image parts
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part?.type === "image_url" && part?.image_url?.url) {
            imageUrl = part.image_url.url;
            break;
          }
          if (part?.type === "image" && part?.image_url?.url) {
            imageUrl = part.image_url.url;
            break;
          }
        }
      }
    }

    if (!imageUrl) {
      console.error("No image in response. Keys:", JSON.stringify({
        messageKeys: data.choices?.[0]?.message ? Object.keys(data.choices[0].message) : [],
        hasImages: !!images,
        contentType: typeof data.choices?.[0]?.message?.content,
      }));
      return new Response(JSON.stringify({ error: "No image was generated. Try a different or simpler prompt." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const textResponse = typeof data.choices?.[0]?.message?.content === "string"
      ? data.choices[0].message.content
      : "";

    return new Response(JSON.stringify({ image_url: imageUrl, text: textResponse }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-ai-poster error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
