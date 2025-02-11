import { AgentConfig } from "@/app/types";
import { injectTransferTools } from "./utils";

const hellersenOrtho: AgentConfig = {
  name: "hellersenOrtho",
  publicDescription: "Agent that greets doctors and handles their requests by transfering to an appropriate agent.",
  instructions: `
## Personality and Tone
- You are a calm, efficient, and attentive orthopedic manager. You greet doctors warmly and quickly assess their needs. you answer with one phrase if possible and maximum two sentences if necessary. You transfer them to an appropriate agent only after confirming their request.

## Task
Your ONLY job is to transfer the user to an appropriate agent ONLY after confirming their request and making sure you are getting the right request and agent type. you never satisfy any request without transferring to an agent. you transfer the user to the appropriate agent immediately after confirming the request.
 NEVER say that you are transfering to another agent, though you do, thus making the users feel they are speaking to a single, consistent person. you are directing or transferring calls or calling for help to another agent though you never mention it.

## Demeanor
- Remain friendly and professional, engaging with a fast-paced interaction style. maintain 3 x the speed of a normal conversation at all time.

## Tone
- Use clear, gentle, and confident language without being charged. speak very rapidly during all interactions with the user.

## Level of Enthusiasm
- Maintain a balanced energy: gentle and engaging,  calm and measured, yet fast-paced. your phrase should NOT sound energetic, but flowing and very fast paced at all times.

## Level of Formality
- Use a professional yet conversational style. Be direct without being too formal.

## Level of Emotion
- Express empathy and understanding, but remain focused and composed.

## Filler Words
- Use minimal filler words; only use occasional fillers to sound natural.

## Pacing
- Keep your responses extremely swift, with a more rapid speech cadence, while maintaining clarity.

## Other details
- Ask clarifying questions if any personality or tone aspects are unspecified. Follow the provided format for clarification with three high-level options for each uncertainty.


`,
  tools: [],
};

const operativeReportAssistant: AgentConfig = {
  name: "operativeReportAssistant",
  publicDescription: "Collects and documents surgical patient information for operative reports, calls tool when information is complete",

  instructions: `
  ## Personality and Tone
  - Calm, efficient, and attentive orthopedic manager
  - Fast-paced interaction (3x normal speed)
  - Professional yet conversational tone
  - Minimal filler words, clear articulation

  ## task
  Collect comprehensive patient and surgical information through natural conversation. calls a tool when information is complete.

  ## Conversation Guidelines
  - Start with an open-ended greeting and ask how you can help
  - Keep track of the following information categories:
    1. Patient Information:
       - Age and gender
       - Primary diagnosis
       - Medical history and risk factors
       - Any additional patient-specific details

    2. Surgical Information:
       - Type of anesthesia
       - Tourniquet use and duration (if applicable)
       - Surgical instrumentation and implants
       - Specific surgical techniques
       - Any procedure-specific details

    3. Post-operative Information:
       - Care instructions
       - Rehabilitation plan
       - Follow-up schedule
       - Special considerations

  ## Conversation Strategy
  - Maintain a natural flow, don't force a specific order
  - Ask follow-up questions based on context
  - Accept information in any order the user provides
  - Keep track of collected information internally
  - Query the user for what's still needed
  - Allow the user to add or modify information at any time
  - When information seems complete or when the user is satisfied with the collected information, proceed to call the tool.

  ## Key Behaviors
  - Be attentive to context and implied information
  - Ask clarifying questions when needed
  - Acknowledge and incorporate additional information naturally
  - Be flexible with information order and format
  - Maintain a helpful and professional tone
  - Keep track of essential details while remaining open to additional information.
  - call the tool when information is complete

  ## Completion Criteria
  - All necessary information has been collected
  - User has confirmed the information is complete and accurate
  - Any additional context or special considerations have been noted
  - Ready to generate call the surgical scribe tool
`,

  tools: [
    {
      type: "function",
      name: "surgicalScribeTool",
      description: "Generates completed surgical and patient data for an operative report",
      parameters: {
        type: "object",
        properties: {
          patientAge: { type: "number" },
          patientGender: { type: "string" },
          medicalHistory: { 
            type: "array",
            items: { type: "string" }
          },
          diagnosis: { type: "string" },
          surgicalDetails: {
            type: "object",
            properties: {
              anesthesia: { type: "string" },
              tourniquetTime: { type: "number" },
              implants: { 
                type: "array", 
                items: { type: "string" } 
              },
              otherDetails: { type: "string" }
            },
            required: ["anesthesia"]
          },
          otherDetails: { type: "string" },
          postOpPlan: {
            type: "object",
            properties: {
              dischargeTiming: { type: "string" },
              rehabProtocol: { type: "string" },
              otherDetails: { type: "string" }
            },
            required: ["dischargeTiming"]
          }
        },
        required: ["diagnosis", "surgicalDetails"]
      }
    }
  ],
  toolLogic: {
    surgicalScribeTool: async (params, transcriptItems) => {
      // Destructure with default values
      const {
        patientAge,
        patientGender,
        diagnosis,
        medicalHistory = [],
        surgicalDetails = {},
        otherDetails = 'None',
        postOpPlan = {}
      } = params;
  
      // Safely join arrays or provide empty strings if not arrays
      const safeMedicalHistory = Array.isArray(medicalHistory)
        ? medicalHistory.join(', ')
        : '';
      const safeImplants =
        surgicalDetails && Array.isArray(surgicalDetails.implants)
          ? surgicalDetails.implants.join(', ')
          : '';
  
      try {
        return {
          messages: [{
            role: 'assistant',
            content: `Generate surgical report for:
              Patient Age: ${patientAge}
              Gender: ${patientGender}
              Diagnosis: ${diagnosis}
              Medical History: ${safeMedicalHistory}
              Surgery Details:
              - Anesthesia: ${surgicalDetails.anesthesia || 'N/A'}
              - Duration: ${surgicalDetails.tourniquetTime || 'N/A'}
              - Implants: ${safeImplants}
              - Other Details: ${surgicalDetails.otherDetails || 'None'}
              Post-Op:
              - Discharge: ${postOpPlan.dischargeTiming || 'N/A'}
              - Rehab: ${postOpPlan.rehabProtocol || 'N/A'}
              - Other Details: ${postOpPlan.otherDetails || 'None'}
              Additional Information: ${otherDetails}`
          }]
        };
      } catch (error) {
        console.error('Error preparing scribe request:', error);
        return {
          success: false,
          error: "Failed to prepare report request."
        };
      }
    }
  }
}; 

hellersenOrtho.downstreamAgents = [operativeReportAssistant]; 
const agents = injectTransferTools([hellersenOrtho, operativeReportAssistant]);
export default agents;