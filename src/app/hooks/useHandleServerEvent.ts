"use client";

import { ServerEvent, SessionStatus, AgentConfig } from "@/app/types";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRef, useCallback, useEffect } from "react";
import { allAgentSets } from "@/app/agentConfigs";
import { usePatientData } from "@/app/contexts/PatientDataContext";
import { useEmail } from "@/app/contexts/EmailContext";

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
  
const selectedAgentNameRef = useRef(selectedAgentName);
useEffect(() => {
  selectedAgentNameRef.current = selectedAgentName;
}, [selectedAgentName]);

const { setPatientData } = usePatientData();
const { setSendEmail } = useEmail();

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
        } 
        
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

          // Check for email trigger JSON from surgicalEditor
          if (role === "assistant") {
            try {
              const parsedResponse = JSON.parse(text);
              if (parsedResponse.type === "string" && parsedResponse.action === "you have to send an email now") {
                console.log("📧 Email trigger detected from surgicalEditor");
                setSendEmail(true);
                break;
              }
            } catch (error) {
              // Not JSON, continue with normal message
            }
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
