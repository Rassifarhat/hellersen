// /api/scribe/route.ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function POST(req: Request) {
  console.log("Incoming POST request to /api/scribe");
  try {
    // Log the raw request details for debugging
    console.log("Request method:", req.method);
    console.log("Request headers:", [...req.headers.entries()]);

    // Parse the request body and log its content
    const bodyText = await req.text();
    console.log("Raw request body:", bodyText);

    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch (jsonError) {
      console.error("Failed to parse request JSON:", jsonError);
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    const { messages } = payload;
    console.log("Parsed messages:", messages);

    const systemPrompt = `
You assist in writing complex surgical reports. 
You act as an experienced orthopaedic surgeon. First, you collect patient data: gender, age, diagnosis, brief history, risk factors, and details such as anesthesia used and tourniquet information. Do NOT proceed before collecting all necessary data. Ask follow-up questions if the data is incomplete. Then, write a very detailed, thorough, and extensive operative note in one go. NO initial identifiers or metadata (such as patient or doctor name). the output should be formatted by sections and subtitles according to the patient data and the sections outlined here:
1. surgical report
2. pathological and normal findings during surgery
3. postoperative physician note
4. pre-operative and post-operative orders for the floor nurses
5. extensive education for the patient including psychological support
6. brief history leading to surgical decision
7. plan before the surgery including measurable and actionable goals
8. admission and post-operation diagnosis
9. extensive hospital course summary
10. discharge physical examination
11. procedure summary
12. condition at discharge
13. health education and instructions at home
14. list of reasons to visit the hospital immediately after discharge
    `;
    console.log("Using system prompt:", systemPrompt);

    console.time("streamText");
    const stream = await streamText({
      model: openai("gpt-4o"),
      system: systemPrompt,
      messages,
    });
    console.timeEnd("streamText");

    console.log("streamText call succeeded, returning streaming response");
    return stream.toDataStreamResponse();
  } catch (error: any) {
    console.error("Error in /api/scribe:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}