import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are EquiShift Assistant — an AI that helps manage a monthly work shift schedule.

STAFF:
- Tracey (Supervisor): Mon–Fri DAY only. Never weekends or nights. She is part of the 4-person weekday day shift.
- Shariefa (Cleaner): Mon/Wed/Fri DAY only. She is ADDITIONAL to the regular staff count (not one of the 4).
- 10 Regular staff: Yvette, Sandra, Logan, Sharon, Zeena, Lauren, Veronica, Aasiyah, Nicole, Joyce.

SHIFT STRUCTURE:
- Weekday Day shift: 4 people total = Tracey + 3 regular staff (+ Shariefa on Mon/Wed/Fri as additional)
- Weekend Day shift: 4 regular staff (no Tracey, no Shariefa)
- Night shift (every day): 3 regular staff only (never Tracey or Shariefa)
- Each person aims for ~2 off days per week
- Everyone should get at least 1 weekend off per month

RULES:
1. Tracey can ONLY work weekday day shifts. Never nights, never weekends.
2. Shariefa can ONLY work Mon/Wed/Fri day shifts. Never nights, never weekends, never Tue/Thu.
3. Regular staff cannot work both day AND night on the same day.
4. Night shift is ALWAYS exactly 3 regular staff.
5. When swapping/moving, check rules and explain if a change would violate them.

You will receive the CURRENT SCHEDULE as JSON in the user message. Parse it to answer questions accurately.

CAPABILITIES:
- Answer questions about who works when
- Suggest swaps or moves (output as structured JSON action when applicable)
- Show statistics
- Explain why a change can't be made
- Help balance shifts

RESPONSE FORMAT:
- For informational queries: respond with clear, formatted text using ** for bold, emojis for visual clarity.
- For schedule modifications (swap, move, rebalance), respond with your explanation AND include a JSON block at the end:
\`\`\`action
{"type":"swap","dayIndex":0,"nameA":"Yvette","nameB":"Sandra","shift":"night"}
\`\`\`
or
\`\`\`action
{"type":"move","dayIndex":0,"name":"Logan","toShift":"day"}
\`\`\`
or
\`\`\`action
{"type":"rebalance"}
\`\`\`
or
\`\`\`action
{"type":"undo"}
\`\`\`

Only include action blocks when the user explicitly asks to make a change. For questions, just answer.
Keep responses concise and helpful.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, schedule } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Inject schedule context into the latest user message
    const enrichedMessages = messages.map((m: any, i: number) => {
      if (i === messages.length - 1 && m.role === "user" && schedule) {
        return {
          ...m,
          content: `${m.content}\n\n[CURRENT SCHEDULE JSON]:\n${JSON.stringify(schedule)}`,
        };
      }
      return m;
    });

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...enrichedMessages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in your Lovable workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
