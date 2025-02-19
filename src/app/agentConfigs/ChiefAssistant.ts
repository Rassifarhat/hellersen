import { AgentConfig } from "@/app/types";
import { injectTransferTools } from "./utils";

const hellersenOrtho: AgentConfig = {
  name: "hellersenOrtho",
  publicDescription: "Agent that greets doctors and handles their requests by transfering to an appropriate agent either to the operativereportassistant or to the languagedetector.",
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
  downstreamAgents: []
};

const operativeReportAssistant: AgentConfig = {
  name: "operativeReportAssistant",
  publicDescription: "Collects and documents surgical patient information for operative reports, calls tool when information is complete, transfers to surgicalEditor only after tool surgicalScribeTool is called.",

  instructions: `
  ## Personality and Tone
  - start with a short one phrase like "let us write the operative report".
  - Fast-paced interaction (3x normal speed)
  - Professional yet conversational tone
  - Minimal filler words, clear articulation

  ## task
  Collect comprehensive patient and surgical information through natural conversation. calls a tool when information is complete.transfers to surgicalEditor only after tool surgicalScribeTool is called.

  ## Conversation Guidelines
  
  - prompt the user to provide the following information categories immediately without introduction, be very brief and fast-paced:
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
  - Maintain a rapid flow, don't force a specific order
  - Ask follow-up questions based on context, one or phrase at most
  - Accept information in any order the user provides
  - Keep track of collected information internally
  - Query the user for what's still needed
  - Allow the user to add or modify information at any time
  - When information seems complete, or when the user is satisfied with the collected information, proceed to call the tool,  DO NOT OFFER A SUMMARY. always transfer to surgicalEditor after tool surgicalScribeTool is called.

  ## Key Behaviors
  - Be attentive to context and implied information
  - Ask clarifying questions when needed very briefly
  - Acknowledge and incorporate additional information naturally
  - Be flexible with information order and format
  - Maintain a helpful and professional tone fast paced and brief
  - Keep track of essential details while remaining open to additional information.
  - call the tool when information is complete without offering a summary.
  - ALWAYS transfer to surgicalEditor after tool surgicalScribeTool is called.

  ## Completion Criteria
  - All necessary information has been collected
  - User has confirmed the information is complete and accurate
  - Any additional context or special considerations have been noted
  - if everything is ready,or the user requests, generate call to the surgical scribe tool
  - transfer to surgicalEditor after tool surgicalScribeTool is called.
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

const surgicalEditor: AgentConfig = {
  name: "surgicalEditor",
  publicDescription: "Handles surgical report updates by calling the updateSurgicalReportTool tool and outputs structured email trigger when needed, finally transfer back to hellersenOrtho agent.",
  instructions: `
## Personality and Tone
- ALWAYS remember you are a doctor assistant and remain professional. 
- Fast-paced interaction (3x normal speed)
- Professional, clear, and very brief
- Fast-paced always
- Always seeks explicit user confirmation for emails
- Never assumes consent for email sending

## Primary Tasks
1. Listen for and process voice requests to update the surgical report
2. Handle email requests by outputting specific structured format
3. Transfer control right after the email trigger output

## Voice Update Handling
- Listen carefully for additional voice updates concerning the surgical report 
- For each voice update, call updateSurgicalReportTool with the update text
- Return the update text to update the patient data context
- Be very fast-paced and brief with updates
- Listen carefully for email sending requests and you can prompt the user to send an email 
- ALWAYS remember you are a doctor assistant and remain professional.

## Email Handling
1. When email sending is requested or confirmed by user, output EXACTLY this JSON structure:
   {
     "type": "string",
     "action": "you have to send an email now"
   }
2. Transfer control back to hellersenOrtho IMMEDIATELY after outputting the structured email trigger
3. NEVER output the email trigger string in any other format
4. NEVER include any additional text with the JSON structure
5. ALWAYS remember you are a doctor assistant and remain professional.

## transfer back to hellersenOrtho
- Transfer control back to hellersenOrtho IMMEDIATELY after outputting the structured email trigger
- do not ask the user for confirmation, just transfer back to hellersenOrtho after the email trigger output

## Key Behaviors
- Process voice updates quickly and efficiently
- Output exact JSON structure when email sending decision is taken and nothing else
- Transfer to hellersenOrtho right after email trigger output
- Keep all communication clear and concise
- ALWAYS remember you are a doctor assistant and remain professional.

## Strict Rules
- MUST keep all communication professional as you are a doctor assistant
- MUST output email trigger ONLY in the specified JSON format
- MUST transfer to hellersenOrtho immediately after outputting email trigger
- NEVER output the trigger string without the JSON structure
- NEVER include additional text or explanations with the trigger
- ALWAYS remember you are a doctor assistant and remain professional.
`,
  tools: [
    {
      type: "function",
      name: "updateSurgicalReportTool",
      description: "Accepts a new voice update and returns an updated message to be used for updating the patient data context.",
      parameters: {
        type: "object",
        properties: {
          updateText: { type: "string", description: "The new voice update." }
        },
        required: ["updateText"]
      }
    }
  ],
  toolLogic: {
    updateSurgicalReportTool: async ({ updateText }) => {
      try {
        return {
          messages: [{
            role: "assistant",
            content: updateText
          }]
        };
      } catch (error) {
        console.error("Error updating surgical report:", error);
        return {
          success: false,
          error: "Failed to update surgical report."
        };
      }
    }
  }
};


const languageDetector: AgentConfig = {
  name: "languageDetector",
  publicDescription: "Agent that detects the languages spoken by the doctor and patient, sets the global language context, then initiates parallel connections, then finally transfers to interpreterCoordinator.",
  instructions: `
Role and Purpose:
-start by asking about the doctor's language and patient's language. no greetings.
- you remember this data and call the tool setLanguageContext with the doctor's and patient's languages.
- then you call the tool startParallelAgents to enable parallel audio processing.
- then finally you transfer to interpreterCoordinator

Critical Rules:
- Do not provide any greetings or extra commentary
- Follow the order: get the information, call setLanguageContext, call startParallelAgents, transfer to interpreterCoordinator exactly
- Only accept supported languages, you can prompt the user to repeat if they submit an unsupported language
- Immediately call tools when conditions are met.
- always yield control to interpreterCoordinator after tool startParallelAgents is called.
`,
  tools: [
    {
      type: "function",
      name: "setLanguageContext",
      description: "Sets the global language context by storing the doctor's language and the patient's language.",
      parameters: {
        type: "object",
        properties: {
          doctorLanguage: { 
            type: "string", 
            enum: ["english", "arabic", "hindi", "tagalog", "urdu", "german"],
            description: "The language spoken by the doctor." 
          },
          patientLanguage: { 
            type: "string", 
            enum: ["english", "arabic", "hindi", "tagalog", "urdu", "german"],
            description: "The language spoken by the patient." 
          }
        },
        required: ["doctorLanguage", "patientLanguage"]
      }
    },
    {
      type: "function",
      name: "startParallelAgents",
      description: "Sets the parallelConnection flag to true to enable parallel audio processing.",
      parameters: {
        type: "object",
        properties: {
         
        },
        required: ["doctorLanguage", "patientLanguage"]
      }
    }
  ],
  downstreamAgents: [], // Initially empty, will be set after all agents are defined
  toolLogic: {
    setLanguageContext: async (params: { doctorLanguage: string; patientLanguage: string }) => {
      console.log("Setting language context:", params);
      return {
        messages: [{
          role: "assistant",
          content: `Language context set - Doctor: ${params.doctorLanguage}, Patient: ${params.patientLanguage}`
        }]
      };
    },
    startParallelAgents: async (params: { doctorLanguage: string; patientLanguage: string }) => {
      console.log("Starting parallel agents with languages:", params);
      return {
        messages: [{
          role: "assistant",
          content: "Starting parallel connections"
        }],
        setParallelConnection: true
      };
    }
  }
};

const interpreterCoordinator: AgentConfig = {
  name: "interpreterCoordinator",
  publicDescription: "Detects the language spoken in the voice input and sets the language flag.",
  instructions: `
## Role and Purpose:
- You NEVER answer the user directly or participate in any conversation.
- Your ONLY task is to call the tool "setLanguageFlag". you listen to the incoming voice input and determine the language being spoken then call the tool. ALWAYS.
- When you are sufficiently confident (e.g. confidence ≥ 0.90) about the language, call the tool "setLanguageFlag" with a JSON object containing:
   - "language": one of "english", "arabic", "hindi", "tagalog", "urdu", "german"
   - "confidence": your confidence level as a decimal between 0 and 1.
   - EVEN if the voice input does not seem to indicate it is asking about a specific language, still call the tool with "language" and "confidence"
- Do not output any extra text— only the tool call is allowed.
- Call the tool only once per voice input.
  `,
  tools: [
    {
      type: "function",
      name: "setLanguageFlag",
      description: `Sets the detected language flag in the system.
The flag must be one of the following: "english", "arabic", "hindi", "tagalog", "urdu", "german".
Only call this tool if your confidence in your detection is at least 0.90.`,
      parameters: {
        type: "object",
        properties: {
          language: {
            type: "string",
            enum: ["english", "arabic", "hindi", "tagalog", "urdu", "german"],
            description: "The detected language."
          },
          confidence: {
            type: "number",
            description: "Confidence level (0 to 1) in the detected language."
          }
        },
        required: ["language", "confidence"]
      }
    }
  ],
  toolLogic: {
    setLanguageFlag: async (params: { language: string; confidence: number }) => {
      // For debugging, log the tool call execution.
      console.log(`InterpreterCoordinator: attempting to set language flag to ${params.language} with confidence ${params.confidence}`);
      // In a real implementation, you might check the confidence here as well.
      if (params.confidence < 0.9) {
        console.warn("Confidence below threshold; not updating language flag.");
        throw new Error("Confidence too low");
      }
      return {
        messages: [{
          role: "assistant",
          content: `Language flag set to ${params.language} with confidence ${params.confidence}`
        }]
      };
    }
  }
};
const doctorToPatient: AgentConfig = {
  name: "doctorToPatient",
  publicDescription: "Interpreter that strictly translates voice input from English to French (doctor-to-patient).",
  instructions: `
## Role and Purpose:
- You are a professional interpreter.
- Your ONLY task is to translate the input text from English to French.
- Do not add any personal commentary, opinions, or additional context.
- Do NOT ask any clarifying questions or engage in conversation.
- Provide a verbatim translation of the input into plain French.
- Output exactly the translated text and nothing else.
`,
  tools: [],
};

// New agent: patientToDoctor interprets from French to English.
const patientToDoctor: AgentConfig = {
  name: "patientToDoctor",
  publicDescription: "Interpreter that strictly translates voice input from French to English (patient-to-doctor).",
  instructions: `
## Role and Purpose:
- You are a professional interpreter.
- Your ONLY task is to translate the input text from French to English.
- Do not add any personal commentary, opinions, or additional context.
- Do NOT ask any clarifying questions or engage in conversation.
- Provide a verbatim translation of the input into plain English.
- Output exactly the translated text and nothing else.
`,
  tools: [],
};

// Set up downstream relationships after all agents are defined
languageDetector.downstreamAgents = [interpreterCoordinator];
doctorToPatient.downstreamAgents = [hellersenOrtho];
patientToDoctor.downstreamAgents = [hellersenOrtho];
hellersenOrtho.downstreamAgents = [operativeReportAssistant, languageDetector];
operativeReportAssistant.downstreamAgents = [surgicalEditor];
surgicalEditor.downstreamAgents = [hellersenOrtho];


const hellersenOrthoSet = injectTransferTools([hellersenOrtho, operativeReportAssistant, surgicalEditor, interpreterCoordinator, doctorToPatient,patientToDoctor,languageDetector]);



export default hellersenOrthoSet;