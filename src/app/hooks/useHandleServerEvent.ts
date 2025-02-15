"use client";

import { ServerEvent, SessionStatus, AgentConfig } from "@/app/types";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRef, useCallback, useEffect } from "react";
import { allAgentSets } from "@/app/agentConfigs";
import { usePatientData } from "@/app/contexts/PatientDataContext";
import { useLanguage, Language } from "@/app/contexts/LanguageContext";
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
  
  const { setDetectedLanguage } = useLanguage();
  const { setPatientData } = usePatientData();
  const selectedAgentNameRef = useRef(selectedAgentName);
  const languageToolCalledRef = useRef(false);

  useEffect(() => {
    selectedAgentNameRef.current = selectedAgentName;
  }, [selectedAgentName]);

  const appendLanguageDetectionPrompt = useCallback(() => {
    // Create a hidden system message to force the interpreter to output only a tool call.
    const hiddenSystemMessage = {
      type: "conversation.item.create",
      item: {
        id: `sys-${uuidv4()}`,
        role: "system",
        // A custom property (e.g. hidden: true) that your UI ignores.
        hidden: true,
        content: [
          {
            type: "text",
            text: "Please determine the language of the preceding voice input and output only a tool call to setLanguageFlag.",
          },
        ],
      },
    };
    console.log("Appending hidden language detection prompt.");
    sendClientEvent(hiddenSystemMessage);
  }, [sendClientEvent]);

  const resetOnSpeechStart = useCallback((serverEvent: ServerEvent) => {
    if (serverEvent.type === "input_audio_buffer.speech_started") {
      console.log("New speech detected. Resetting language tool flag.");
      languageToolCalledRef.current = false;
      appendLanguageDetectionPrompt();
    }
  }, [appendLanguageDetectionPrompt]);

  const handleFunctionCall = useCallback(
    async (functionCallParams: {
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

        if (functionCallParams.name === 'surgicalScribeTool') {
          console.log('🔄 Switching to Surgical Scribe display mode');
          const patientContent = fnResult.messages?.[0]?.content;
          if (patientContent) {
            setPatientData({ content: patientContent });
          } else {
            console.error("No content found in surgicalScribeTool result");
          }
        }
        else if (functionCallParams.name === "updateSurgicalReportTool") {
          console.log("🔄 Surgical Editor update received");
          const updateText = args.updateText;
          if (updateText) {
              setPatientData({ content: updateText });
          } else {
            console.error("No update text provided in updateSurgicalReportTool call");
          }
        } else if (functionCallParams.name === "setLanguageFlag") {
          if (languageToolCalledRef.current) {
            console.log("setLanguageFlag already called for this input. Ignoring duplicate.");
            return;
          }
          languageToolCalledRef.current = true;

          console.log("├──  Language Detection Started");
          console.log("├── Input Language:", args.language);
          const threshold = 0.9;
          if (args.confidence < threshold) {
            console.log(`Detected confidence (${args.confidence}) is below threshold (${threshold}). Ignoring tool call.`);
            addTranscriptBreadcrumb("Language detection confidence too low", { language: args.language, confidence: args.confidence });
            return;
          }
          try {
            // Update the language context.
            setDetectedLanguage(args.language as Language);
            console.log("🌐 Language Context Updated:", args.language);
            // Execute the tool logic.
            const result = await currentAgent.toolLogic["setLanguageFlag"](args, transcriptItems);
            addTranscriptBreadcrumb(`Language detected and set: ${args.language}`, {
              language: args.language,
            });
            console.log("🌐 Language Detection Complete:", args.language);
            // Send tool call output.
           
          } catch (error) {
            console.error("❌ Language Detection Failed:", error);
            addTranscriptBreadcrumb("Language detection failed", { success: false, error });
          }
          return;
        }
        if (functionCallParams.name !== "setLanguageFlag") {
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
        sendClientEvent({ type: "response.create" });}
      } else if (functionCallParams.name === "transferAgents") {
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
      } else {
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
    },
    [
      selectedAgentConfigSet,
      selectedAgentName,
      sendClientEvent,
      setSelectedAgentName,
      toggleGlobalFlag,
      transcriptItems,
      addTranscriptBreadcrumb,
      addTranscriptMessage
    ]
  );

  return useCallback(
    (serverEvent: ServerEvent) => {
      if (!shouldProcessEvents && serverEvent.type !== "connection_status_changed") {
        console.log("Event processing disabled, skipping event:", serverEvent.type);
        return;
      }

      logServerEvent(serverEvent);

      if (selectedAgentNameRef.current === "interpreterCoordinator") {
        resetOnSpeechStart(serverEvent);
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
        // Also, if any audio-related events come in, discard them.
        if (
          serverEvent.type === "response.audio_transcript.delta" ||
          serverEvent.type === "response.audio_transcript.done" ||
          serverEvent.type === "response.audio.delta" ||
          serverEvent.type === "response.audio.done"
        ) {
          console.log("Discarding audio event for interpreterCoordinator.");
          return;
        }
        if (serverEvent.type === "response.create") {
          console.log("Discarding response.create event for interpreterCoordinator.");
          return;
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
