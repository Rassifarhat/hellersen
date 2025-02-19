"use client";

import { ServerEvent, SessionStatus, AgentConfig } from "@/app/types";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRef, useCallback, useEffect } from "react";
import { allAgentSets } from "@/app/agentConfigs";
import { usePatientData } from "@/app/contexts/PatientDataContext";
import { useLanguage, Language } from "@/app/contexts/LanguageContext";
import { useGlobalFlag } from "@/app/contexts/GlobalFlagContext";
import { v4 as uuidv4 } from 'uuid';

export interface UseHandleServerEventParams {
  setSessionStatus: (status: SessionStatus) => void;
  selectedAgentName: string;
  selectedAgentConfigSet: AgentConfig[] | null;
  sendClientEvent: (eventObj: any, eventNameSuffix?: string) => void;
  setSelectedAgentName: (name: string) => void;
  shouldForceResponse?: boolean;
  toggleGlobalFlag: () => void;
  shouldProcessEvents?: boolean;
}

export function useHandleServerEvent({
  setSessionStatus,
  selectedAgentName,
  selectedAgentConfigSet,
  sendClientEvent,
  setSelectedAgentName,
  shouldForceResponse = false,
  toggleGlobalFlag,
  shouldProcessEvents = true,
}: UseHandleServerEventParams) {
  
  const {
    transcriptItems,
    addTranscriptBreadcrumb,
    addTranscriptMessage,
    updateTranscriptMessage,
    updateTranscriptItemStatus,
  } = useTranscript();

  const { logServerEvent } = useEvent();
  
  const { setLanguageContext } = useLanguage();
  const { setSpokenLanguage } = useGlobalFlag();
  const { setParallelConnection } = useGlobalFlag();
  const { setPatientData } = usePatientData();
  const selectedAgentNameRef = useRef(selectedAgentName);
  const languageToolCalledRef = useRef(false);

  useEffect(() => {
    selectedAgentNameRef.current = selectedAgentName;
    
    // Update session modalities when switching to interpreterCoordinator
    if (selectedAgentName === "interpreterCoordinator") {
      console.log("🔄 Switching to text-only mode for interpreterCoordinator");
      sendClientEvent({
        type: "session.update",
        session: {
          modalities: ["text"],
          tool_choice: "auto"
        }
      });
    } 
  }, [selectedAgentName, sendClientEvent]);

  

  const appendHiddenSystemMessage = useCallback(async (text: string) => {
    try {
      const systemMessage = {
        type: "conversation.item.create",
        item: {
          id: `sys-${uuidv4()}`,
          role: "system",
          hidden: true,
          content: [
            {
              type: "text",
              text
            },
          ],
        },
      };

      console.log(`🔄 Appending system message: ${text}`);
      sendClientEvent(systemMessage);
      return { success: true };
    } catch (error) {
      console.error("Error appending system message:", error);
      addTranscriptBreadcrumb("Failed to append system message", {
        error: String(error),
        text
      });
      throw error;
    }
  }, [sendClientEvent, addTranscriptBreadcrumb]);

  const appendLanguageDetectionPrompt = useCallback(() => {
    return appendHiddenSystemMessage(
      "Please determine the language of the voice input and output only a tool call to setLanguageFlag."
    );
  }, [appendHiddenSystemMessage]);

  const appendParallelAgentsPrompt = useCallback(async (doctorLanguage: string, patientLanguage: string) => {
    return appendHiddenSystemMessage(
      `You are now in parallel connection mode. The doctor speaks ${doctorLanguage} and the patient speaks ${patientLanguage}. Please coordinate the conversation between them.`
    );
  }, [appendHiddenSystemMessage]);

  const appendInterpreterTransferPrompt = useCallback(() => {
    return appendHiddenSystemMessage(
      `Please call the transferAgents tool with destination_agent: "interpreterCoordinator". Do not modify this value.`
    );
  }, [appendHiddenSystemMessage]);






  const handleSetLanguageFlag = useCallback(async (language: string) => {
    try {
      if (!language || language.toLowerCase() === 'unknown') {
        throw new Error("Valid language is required");
      }

      if (languageToolCalledRef.current) {
        console.log("Language already set for this input, ignoring duplicate call");
        return { success: false, reason: "Language already set" };
      }

      languageToolCalledRef.current = true;
      setSpokenLanguage(language.toLowerCase());
      console.log("🌐 Language detected:", language);
      addTranscriptBreadcrumb(`Language detected: ${language}`, { language });
      
      return { success: true, language };
    } catch (error) {
      console.error("Error in handleSetLanguageFlag:", error);
      addTranscriptBreadcrumb("Failed to set language", { 
        error: String(error),
        language
      });
      throw error;
    }
  }, [setSpokenLanguage, addTranscriptBreadcrumb]);

  const handleSetLanguageContext = useCallback(async (doctor: string, patient: string) => {
    try {
      if (!doctor || !patient) {
        throw new Error("Invalid language context: both doctor and patient languages must be provided");
      }
      
      const doctorLang = doctor.toLowerCase() as Language;
      const patientLang = patient.toLowerCase() as Language;
      
      setLanguageContext(doctorLang, patientLang);
      addTranscriptBreadcrumb(`Language context set`, { doctor: doctorLang, patient: patientLang });
      return { success: true };
    } catch (error) {
      console.error("Error setting language context:", error);
      addTranscriptBreadcrumb("Failed to set language context", { error: String(error) });
      throw error; // Re-throw to be handled by the caller
    }
  }, [setLanguageContext, addTranscriptBreadcrumb]);

  const resetLanguageState = useCallback(() => {
    languageToolCalledRef.current = false;
    setSpokenLanguage("unknown");
  }, [setSpokenLanguage]);

  const handleSpeechStart = useCallback((serverEvent: ServerEvent) => {
    if (serverEvent.type === "input_audio_buffer.speech_started") {
      console.log("New speech detected. Resetting language detection state.");
      resetLanguageState();
      appendLanguageDetectionPrompt();
    }
  }, [resetLanguageState, appendLanguageDetectionPrompt]);

  const handleFunctionCall = async (functionCallParams: {
    name: string;
    call_id?: string;
    arguments: string;
  }) => {
    const args = JSON.parse(functionCallParams.arguments);
    const currentAgent = selectedAgentConfigSet?.find(
      (a) => a.name === selectedAgentNameRef.current
    );

    addTranscriptBreadcrumb(`function call: ${functionCallParams.name}`, args);
    if (currentAgent?.toolLogic?.[functionCallParams.name]) {
      const fn = currentAgent.toolLogic[functionCallParams.name];
      const fnResult = await fn(args, transcriptItems);

      switch (functionCallParams.name) {
        case 'surgicalScribeTool': {
          console.log('🔄 Switching to Surgical Scribe display mode');
          const patientContent = fnResult.messages?.[0]?.content;
          if (patientContent) {
            setPatientData({ content: patientContent });
          } else {
            console.error("No content found in surgicalScribeTool result");
          }
          break;
        }

        case 'updateSurgicalReportTool': {
          console.log("🔄 Surgical Editor update received");
          const updateText = args.updateText;
          if (updateText) {
            setPatientData({ content: updateText });
          } else {
            console.error("No update text provided in updateSurgicalReportTool call");
          }
          break;
        }

        case 'setLanguageFlag': {
          const result = await handleSetLanguageFlag(args.language);
          if (result.success) {
            break;
          } else {
            console.error("Failed to set language flag:", result.reason);
            addTranscriptBreadcrumb("Failed to set language flag", { reason: result.reason });
            return;
          }
        }

        case 'setLanguageContext': {
          console.log("🔄 Setting language context");
          const { doctorLanguage, patientLanguage } = args;
          if (!doctorLanguage || !patientLanguage) {
            console.error("Missing language parameters in setLanguageContext call");
            return;
          }
          try {
            // Set the language context (now async)
            await handleSetLanguageContext(doctorLanguage, patientLanguage);
            
            // Then execute the tool logic (async operation)
            const result = await currentAgent.toolLogic["setLanguageContext"](args, transcriptItems);
            
            // Verify the language context was set correctly
            if (!result || result.error) {
              throw new Error(result?.error || 'Failed to set language context');
            }
            
            // Log success
            console.log("🌐 Language Context Updated:", { doctorLanguage, patientLanguage });
            
            // Append parallel agents prompt (async operation)
            await appendParallelAgentsPrompt(doctorLanguage, patientLanguage);
            console.log("✅ Parallel agents prompt appended with verified language context");
          } catch (error) {
            console.error("Error in language context setup:", error);
            addTranscriptBreadcrumb("Error setting language context", { 
              error: String(error),
              phase: "context_setup"
            });
          }
          break;
        }

        case 'startParallelAgents': {
          console.log("🔄 Starting parallel agents");
          const { doctorLanguage, patientLanguage } = args;
          if (!doctorLanguage || !patientLanguage) {
            console.error("Missing language parameters in startParallelAgents call");
            return;
          }
          try {
            setParallelConnection(true);
            const result = await currentAgent.toolLogic["startParallelAgents"](args, transcriptItems);
            addTranscriptBreadcrumb(`Parallel agents started`, { doctorLanguage, patientLanguage });
            console.log("🌐 Parallel Agents Started:", { doctorLanguage, patientLanguage });
            appendInterpreterTransferPrompt();
          } catch (error) {
            console.error("Error starting parallel agents:", error);
            addTranscriptBreadcrumb("Error starting parallel agents", { error: String(error) });
          }
          break;
        }

        default: {
          addTranscriptBreadcrumb(
            `function call result: ${functionCallParams.name}`,
            fnResult
          );
    
          sendClientEvent({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: functionCallParams.call_id,
              output: JSON.stringify(fnResult),
            },
          });
          sendClientEvent({ type: "response.create" });
        }
      }
    }
    else if (functionCallParams.name === "transferAgents") {
      const destinationAgent = args.destination_agent;
      const newAgentConfig =
        selectedAgentConfigSet?.find((a) => a.name === destinationAgent) || null;
      if (newAgentConfig) {
        setSelectedAgentName(destinationAgent);
      }
      const functionCallOutput = {
        destination_agent: destinationAgent,
        did_transfer: !!newAgentConfig,
      };
      sendClientEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: functionCallParams.call_id,
          output: JSON.stringify(functionCallOutput),
        },
      });
      addTranscriptBreadcrumb(
        `function call: ${functionCallParams.name} response`,
        functionCallOutput
      );
    }
    else {
      // Handle functions without tool logic
      const simulatedResult = { result: true };
      addTranscriptBreadcrumb(
        `function call fallback: ${functionCallParams.name}`,
        simulatedResult
      );

      sendClientEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: functionCallParams.call_id,
          output: JSON.stringify(simulatedResult),
        },
      });
      sendClientEvent({ type: "response.create" });
    }
  };

  return useCallback(
    (serverEvent: ServerEvent) => {
      if (!shouldProcessEvents && serverEvent.type !== "connection_status_changed") {
        console.log("Event processing disabled, skipping event:", serverEvent.type);
        return;
      }

      logServerEvent(serverEvent);

      if (selectedAgentNameRef.current === "interpreterCoordinator") {
        handleSpeechStart(serverEvent);
        if (
          serverEvent.type === "conversation.item.created" &&
          serverEvent.item?.role === "assistant"
        ) {
          // If the item type is not explicitly a function_call_output, discard it.
          if (serverEvent.item.type !== "function_call_output") {
            console.log("Discarding non-tool output from interpreterCoordinator:", serverEvent.item);
            return;
          }
          const content = serverEvent.item.content?.[0]?.text;
          if (content) {
            try {
              // Try to parse the text. If it fails, then this output is not a valid tool call.
              JSON.parse(content);
              // If parsing succeeds, then it is a tool call.
              console.log("Valid tool call detected from interpreterCoordinator.");
            } catch (error) {
              // Not parseable as JSON: Discard this output.
              console.log("Discarding non-tool output from interpreterCoordinator.");
              addTranscriptBreadcrumb(
                "Ignored output from interpreterCoordinator",
                { reason: "Non-structured output" }
              );
              return; // Abort processing this event.
            }
          } else {
            // No content: Discard as well.
            console.log("Discarding empty output from interpreterCoordinator.");
            return;
          }
        }
      }
      
      switch (serverEvent.type) {
        case "session.created": {
          if (serverEvent.session?.id) {
            setSessionStatus("CONNECTED");
            addTranscriptBreadcrumb(
              `session.id: ${
                serverEvent.session.id
              }\nStarted at: ${new Date().toLocaleString()}`
            );
          }
          break;
        }

        case "conversation.item.created": {
          let text =
            serverEvent.item?.content?.[0]?.text ||
            serverEvent.item?.content?.[0]?.transcript ||
            "";
          const role = serverEvent.item?.role as "user" | "assistant";
          const itemId = serverEvent.item?.id;

          if (itemId && transcriptItems.some((item) => item.itemId === itemId)) {
            break;
          }
          if (itemId && role) {
            if (role === "user" && !text) {
              text = "[Transcribing...]";
            }
            addTranscriptMessage(itemId, role, text);
          }
          break;
        }

        case "conversation.item.input_audio_transcription.completed": {
          const itemId = serverEvent.item_id;
          const finalTranscript =
            !serverEvent.transcript || serverEvent.transcript === "\n"
              ? "[inaudible]"
              : serverEvent.transcript;
          if (itemId) {
            updateTranscriptMessage(itemId, finalTranscript, false);
          }
          break;
        }

        case "response.audio_transcript.delta": {
          const itemId = serverEvent.item_id;
          const deltaText = serverEvent.delta || "";
          if (itemId) {
            updateTranscriptMessage(itemId, deltaText, true);
          }
          break;
        }

        case "response.done": {
          if (serverEvent.response?.output) {
            serverEvent.response.output.forEach((outputItem) => {
              if (
                outputItem.type === "function_call" &&
                outputItem.name &&
                outputItem.arguments
              ) {
                handleFunctionCall({
                  name: outputItem.name,
                  call_id: outputItem.call_id,
                  arguments: outputItem.arguments,
                });
              }
            });
          }
          break;
        }

        case "response.output_item.done": {
          const itemId = serverEvent.item?.id;
          if (itemId) {
            updateTranscriptItemStatus(itemId, "DONE");
          }
          break;
        }

        default:
          break;
      }
    },
    [
      addTranscriptBreadcrumb,
      addTranscriptMessage,
      handleFunctionCall,
      logServerEvent,
      setSessionStatus,
      shouldProcessEvents,
      transcriptItems,
      updateTranscriptItemStatus,
      updateTranscriptMessage,
    ]
  );
}
