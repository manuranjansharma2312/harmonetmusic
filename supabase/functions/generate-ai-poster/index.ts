import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build prompt with aspect ratio instruction
    let fullPrompt = prompt.trim();
    if (aspectRatio) {
      fullPrompt += ` Generate the image in ${aspectRatio} aspect ratio.`;
    }

    // Build message content - text only or multimodal with reference image
    let messageContent: any;
    if (referenceImage && typeof referenceImage === "string") {
      messageContent = [
        { type: "text", text: `Use this reference image as style/design inspiration. ${fullPrompt}` },
        { type: "image_url", image_url: { url: referenceImage } },
      ];
    } else {
      messageContent = fullPrompt;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
    });

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
    console.log("AI response structure:", JSON.stringify({
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length,
      messageKeys: data.choices?.[0]?.message ? Object.keys(data.choices[0].message) : [],
      hasImages: !!data.choices?.[0]?.message?.images,
      imagesLength: data.choices?.[0]?.message?.images?.length,
      contentPreview: typeof data.choices?.[0]?.message?.content === 'string' 
        ? data.choices[0].message.content.substring(0, 200) 
        : typeof data.choices?.[0]?.message?.content,
    }));

    // Try multiple extraction paths
    let imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    // Fallback: check if image is inline in content as base64
    if (!imageUrl) {
      const content = data.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.includes('data:image')) {
        const match = content.match(/(data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)/);
        if (match) imageUrl = match[1];
      }
      // Check if content is array with image parts
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part?.type === 'image_url') {
            imageUrl = part.image_url?.url;
            break;
          }
          if (part?.type === 'image' && part?.image_url?.url) {
            imageUrl = part.image_url.url;
            break;
          }
        }
      }
    }

    const textResponse = typeof data.choices?.[0]?.message?.content === 'string' 
      ? data.choices[0].message.content 
      : "";

    if (!imageUrl) {
      console.error("No image found in response. Full response:", JSON.stringify(data).substring(0, 2000));
      return new Response(JSON.stringify({ error: "No image was generated. Try a different prompt." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
