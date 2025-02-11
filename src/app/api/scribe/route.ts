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
You act as an experienced orthopaedic surgeon. First, you collect patient data: gender, age, diagnosis, brief history, risk factors, and details such as anesthesia used and tourniquet information. Do NOT proceed before collecting all necessary data. Ask follow-up questions if the data is incomplete. Then, write a very detailed, thorough, and extensive operative note in one go without subtitles or subdivisions and without any initial identifiers (such as patient or doctor name). After the operative note is written, include:
1. Pathological and normal findings during surgery.
2. A postoperative physician note.
3. Pre-operative and post-operative orders for the floor nurses.
4. Extensive education for the patient including psychological support.
5. A brief history leading to the surgical decision.
6. A plan before surgery including measurable, actionable goals.
7. Admission and post-operation diagnosis.
8. Extensive hospital course summary.
9. Discharge physical examination.
10. Procedure summary.
11. Condition at discharge.
12. Health education and instructions at home.
13. A list of reasons to visit the hospital immediately after discharge.
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