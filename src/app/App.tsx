"use client";

import React, { useEffect, useRef, useState, RefObject, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import Image from "next/image";

// UI components
import Transcript from "./components/Transcript";
import BottomToolbar from "./components/BottomToolbar";
import Dashboard from "./components/Dashboard";

// Types
import { AgentConfig, SessionStatus } from "@/app/types"; 

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useHandleServerEvent } from "./hooks/useHandleServerEvent";
import { useGlobalFlag } from "./contexts/GlobalFlagContext";
import { useLanguage } from "./contexts/LanguageContext";

// Utilities
import { createRealtimeConnection } from "./lib/realtimeConnection";

// Agent configs
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";

interface AudioBuffer {
  chunks: Blob[];
  addChunk: (chunk: Blob) => void;
  clear: () => void;
  getAudioBlob: () => Blob;
}



function App() {
  const searchParams = useSearchParams();

  const { transcriptItems, addTranscriptMessage, addTranscriptBreadcrumb } =
    useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();
  const { parallelConnection, micStream, activeWebRtc, toggleGlobalFlag, spokenLanguage } = useGlobalFlag();
  const { doctorLanguage, patientLanguage } = useLanguage();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] =
    useState<AgentConfig[] | null>(null);

  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("DISCONNECTED");

  const [isEventsPaneExpanded, setIsEventsPaneExpanded] =
    useState<boolean>(true);
  const [userText, setUserText] = useState<string>("");
  const [isPTTActive, setIsPTTActive] = useState<boolean>(false);
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] =
    useState<boolean>(true);
    
    const pcDoctorToPatientRef = useRef<RTCPeerConnection | null>(null);
    const dcDoctorToPatientRef = useRef<RTCDataChannel | null>(null);
    const [sessionStatusDoctorToPatient, setSessionStatusDoctorToPatient] =
    useState<SessionStatus>("DISCONNECTED");
  const [sessionStatusPatientToDoctor, setSessionStatusPatientToDoctor] =
    useState<SessionStatus>("DISCONNECTED");
   
    // New refs for patientToDoctor connection
    const pcPatientToDoctorRef = useRef<RTCPeerConnection | null>(null);
    const dcPatientToDoctorRef = useRef<RTCDataChannel | null>(null);
    const [dataChannelDoctorToPatient, setDataChannelDoctorToPatient] = useState<RTCDataChannel | null>(null);
const [dataChannelPatientToDoctor, setDataChannelPatientToDoctor] = useState<RTCDataChannel | null>(null);

const doctorToPatientBuffer = useRef<AudioBuffer>({
  chunks: [],
  addChunk: function (chunk: Blob) {
    this.chunks.push(chunk);
  },
  clear: function () {
    this.chunks = [];
  },
  getAudioBlob: function () {
    return new Blob(this.chunks, { type: "audio/webm" });
  },
});

const patientToDoctorBuffer = useRef<AudioBuffer>({
  chunks: [],
  addChunk: function (chunk: Blob) {
    this.chunks.push(chunk);
  },
  clear: function () {
    this.chunks = [];
  },
  getAudioBlob: function () {
    return new Blob(this.chunks, { type: "audio/webm" });
  },
});



const connectionOutputBuffer = async (
  sessionType: "doctorToPatient" | "patientToDoctor",
  EPHEMERAL_KEY: string,
  micStream: MediaStream,
  buffer: AudioBuffer // Structured buffer object
): Promise<{ pc: RTCPeerConnection; dc: RTCDataChannel }> => {

  const pc = new RTCPeerConnection();

  // Handle incoming audio: Store in buffer instead of direct playback
  pc.ontrack = (e) => {
    if (e.streams[0]) {
      const stream = e.streams[0];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          buffer.addChunk(event.data);
          console.log(`[${sessionType}] Audio chunk added to buffer.`);
        }
      };

      mediaRecorder.onstop = () => {
        console.log(`[${sessionType}] MediaRecorder stopped. Finalizing buffer.`);
      };

      mediaRecorder.start(100); // Collect data in 100ms chunks

      // Stop recording when track ends
      stream.getTracks().forEach(track => {
        track.onended = () => {
          mediaRecorder.stop();
        };
      });
    }
  };

  // Attach mic audio track
  const track = micStream.getAudioTracks()[0];
  if (track) pc.addTrack(track);

  // Create DataChannel dynamically based on session type
  const dc = pc.createDataChannel(sessionType);

  // WebRTC SDP handshake with OpenAI
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const baseUrl = "https://api.openai.com/v1/realtime";
  const model = "gpt-4o-realtime-preview-2024-12-17";

  const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
    method: "POST",
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${EPHEMERAL_KEY}`,
      "Content-Type": "application/sdp",
    },
  });

  const answerSdp = await sdpResponse.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

  return { pc, dc };
};

const connectAgentSession = async (
  sessionType: "doctorToPatient" | "patientToDoctor",
  bufferRef: RefObject<AudioBuffer>,
  pcRef: RefObject<RTCPeerConnection | null>,
  dcRef: RefObject<RTCDataChannel | null>,
  setSessionStatusLocal: (status: SessionStatus) => void // Local, NOT global!
) => {
  if (pcRef.current) return; // Prevent duplicate connections

  setSessionStatusLocal("CONNECTING"); // Only updates the agent session

  try {
    const EPHEMERAL_KEY = await fetchEphemeralKey();
    if (!EPHEMERAL_KEY) return;

    if (!micStream) {
      console.error(`[${sessionType}] No microphone stream available`);
      setSessionStatusLocal("DISCONNECTED");
      return;
    }

    const { pc, dc } = await connectionOutputBuffer(sessionType, EPHEMERAL_KEY, micStream, bufferRef.current);

    pcRef.current = pc;
    dcRef.current = dc;

    dc.addEventListener("open", () => {
      console.log(`[${sessionType}] Data Channel Opened`);
    });

    dc.addEventListener("message", (e) => {
      const event = JSON.parse(e.data);
      if (event.type === "conversation.item.input_audio_transcription.completed") {
        console.log(`[${sessionType}] Voice buffer ready`);
      }
    });

    dc.addEventListener("close", () => {
      console.log(`[${sessionType}] Data Channel Closed`);
      setSessionStatusLocal("DISCONNECTED"); // Only affect local session status
      pcRef.current = null;
      dcRef.current = null;
    });

    setSessionStatusLocal("CONNECTED");
  } catch (err) {
    console.error(`[${sessionType}] Connection error:`, err);
    setSessionStatusLocal("DISCONNECTED");
  }
};

const startParallelConnections = useCallback(async () => {
  if (!micStream) {
    console.error("No microphone stream available for parallel connections");
    return;
  }

  console.log("🔄 Starting parallel connections");
  console.log("Doctor Language:", doctorLanguage);
  console.log("Patient Language:", patientLanguage);

  try {
    // Start doctor-to-patient connection
    if (sessionStatusDoctorToPatient === "DISCONNECTED") {
      await connectAgentSession(
        "doctorToPatient",
        doctorToPatientBuffer,
        pcDoctorToPatientRef,
        dcDoctorToPatientRef,
        setSessionStatusDoctorToPatient
      );
    }

    // Start patient-to-doctor connection
    if (sessionStatusPatientToDoctor === "DISCONNECTED") {
      await connectAgentSession(
        "patientToDoctor",
        patientToDoctorBuffer,
        pcPatientToDoctorRef,
        dcPatientToDoctorRef,
        setSessionStatusPatientToDoctor
      );
    }

    console.log("✅ Parallel connections started successfully");
  } catch (error) {
    console.error("❌ Error starting parallel connections:", error);
    // Cleanup on error
    if (pcDoctorToPatientRef.current) {
      pcDoctorToPatientRef.current.close();
      pcDoctorToPatientRef.current = null;
    }
    if (pcPatientToDoctorRef.current) {
      pcPatientToDoctorRef.current.close();
      pcPatientToDoctorRef.current = null;
    }
    setSessionStatusDoctorToPatient("DISCONNECTED");
    setSessionStatusPatientToDoctor("DISCONNECTED");
  }
}, [
  micStream,
  doctorLanguage,
  patientLanguage,
  sessionStatusDoctorToPatient,
  sessionStatusPatientToDoctor,
]);

useEffect(() => {
  if (selectedAgentName && sessionStatus === "DISCONNECTED") {
    connectToRealtime();
  }
}, [selectedAgentName]);

useEffect(() => {
  if (pcRef.current) {
    const senders = pcRef.current.getSenders();
    senders.forEach((sender) => {
      if (sender.track) {
        sender.track.enabled = activeWebRtc;
        console.log(`WebRTC ${sender.track.kind} track ${activeWebRtc ? "enabled" : "disabled"}`);
      }
    });
  }
}, [activeWebRtc]);



// Effect to handle parallel connections
useEffect(() => {
  if (parallelConnection && doctorLanguage && patientLanguage) {
    startParallelConnections();
  }
}, [parallelConnection, doctorLanguage, patientLanguage, startParallelConnections]);

// Separate effect for audio routing


const routeAudioBuffer = useCallback(() => {
  if (!spokenLanguage || spokenLanguage === "unknown") {
    console.log("❌ Cannot route audio: spoken language not detected");
    return;
  }

  if (!doctorLanguage || !patientLanguage) {
    console.log("❌ Cannot route audio: language context not set");
    return;
  }

  if (!parallelConnection) {
    console.log("❌ Cannot route audio: parallel connections not established");
    return;
  }

  console.log("🔄 Routing audio based on language matching");
  console.log("Spoken Language:", spokenLanguage);
  console.log("Doctor Language:", doctorLanguage);
  console.log("Patient Language:", patientLanguage);

  if (!audioElementRef.current) {
    console.error("❌ No audio element available for playback");
    return;
  }

  try {
    // If doctor is speaking (language matches doctor's language)
    if (spokenLanguage.toLowerCase() === doctorLanguage?.toLowerCase()) {
      console.log("👨‍⚕️ Doctor is speaking - using doctor-to-patient buffer");
      const audioBlob = doctorToPatientBuffer.current.getAudioBlob();
      const audioUrl = URL.createObjectURL(audioBlob);
      audioElementRef.current.src = audioUrl;
      audioElementRef.current.play();
      
      // Clean up URL after playback
      audioElementRef.current.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
    }
    // If patient is speaking (language matches patient's language)
    else if (spokenLanguage.toLowerCase() === patientLanguage?.toLowerCase()) {
      console.log("👤 Patient is speaking - using patient-to-doctor buffer");
      const audioBlob = patientToDoctorBuffer.current.getAudioBlob();
      const audioUrl = URL.createObjectURL(audioBlob);
      audioElementRef.current.src = audioUrl;
      audioElementRef.current.play();
      
      // Clean up URL after playback
      audioElementRef.current.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
    } else {
      console.log("❌ Spoken language doesn't match either party - discarding buffers");
    }
  } catch (error) {
    console.error("❌ Error routing audio:", error);
  } finally {
    // Clear both buffers regardless of which one was used
    console.log("🧹 Clearing audio buffers");
    doctorToPatientBuffer.current.clear();
    patientToDoctorBuffer.current.clear();
  }
}, [spokenLanguage, doctorLanguage, patientLanguage]);
useEffect(() => {
  if (spokenLanguage && spokenLanguage !== "unknown") {
    routeAudioBuffer();
  }
}, [spokenLanguage, routeAudioBuffer]);
// Effect to cleanup parallel connections when disabled
useEffect(() => {
  if (!parallelConnection) {
    console.log("🔄 Cleaning up parallel connections");
    
    // Cleanup doctor-to-patient connection
    if (pcDoctorToPatientRef.current) {
      pcDoctorToPatientRef.current.close();
      pcDoctorToPatientRef.current = null;
    }
    if (dcDoctorToPatientRef.current) {
      dcDoctorToPatientRef.current.close();
      dcDoctorToPatientRef.current = null;
    }
    setSessionStatusDoctorToPatient("DISCONNECTED");
    
    // Cleanup patient-to-doctor connection
    if (pcPatientToDoctorRef.current) {
      pcPatientToDoctorRef.current.close();
      pcPatientToDoctorRef.current = null;
    }
    if (dcPatientToDoctorRef.current) {
      dcPatientToDoctorRef.current.close();
      dcPatientToDoctorRef.current = null;
    }
    setSessionStatusPatientToDoctor("DISCONNECTED");
  }
}, [parallelConnection]);

useEffect(() => {
  if (parallelConnection) {
    startParallelConnections();
  }
}, [parallelConnection, micStream]);


    
  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    if (!activeWebRtc) {
      console.log('Media control paused due to inactive mic:', eventObj.type);
      return;
    }
    if (dcRef.current && dcRef.current.readyState === "open") {
      logClientEvent(eventObj, eventNameSuffix);
      dcRef.current.send(JSON.stringify(eventObj));
    } else {
      logClientEvent(
        { attemptedEvent: eventObj.type },
        "error.data_channel_not_open"
      );
      console.error(
        "Failed to send message - no data channel available",
        eventObj
      );
    }
  };

  const handleServerEvent = useHandleServerEvent({
    setSessionStatus,
    selectedAgentName,
    selectedAgentConfigSet,
    sendClientEvent,
    setSelectedAgentName,
    toggleGlobalFlag,
    shouldProcessEvents: activeWebRtc,
  });

  useEffect(() => {
    let finalAgentConfig = searchParams.get("agentConfig");
    if (!finalAgentConfig || !allAgentSets[finalAgentConfig]) {
      finalAgentConfig = defaultAgentSetKey;
      const url = new URL(window.location.toString());
      url.searchParams.set("agentConfig", finalAgentConfig);
      window.location.replace(url.toString());
      return;
    }

    const agents = allAgentSets[finalAgentConfig];
    const agentKeyToUse = agents[0]?.name || "";

    setSelectedAgentName(agentKeyToUse);
    setSelectedAgentConfigSet(agents);
  }, [searchParams]);

  useEffect(() => {
    if (selectedAgentName && sessionStatus === "DISCONNECTED") {
    connectToRealtime();
  }
}, [selectedAgentName]);

  useEffect(() => {
    if (
      sessionStatus === "CONNECTED" &&
      selectedAgentConfigSet &&
      selectedAgentName
    ) {
      const currentAgent = selectedAgentConfigSet.find(
        (a) => a.name === selectedAgentName
      );
      addTranscriptBreadcrumb(
        `Agent: ${selectedAgentName}`,
        currentAgent
      );
      updateSession(true);
    }
  }, [selectedAgentConfigSet, selectedAgentName, sessionStatus]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      console.log(
        `updatingSession, isPTTActive=${isPTTActive} sessionStatus=${sessionStatus}`
      );
      updateSession();
    }
  }, [isPTTActive]);

  useEffect(() => {
    if (pcRef.current) {
      const senders = pcRef.current.getSenders();
      senders.forEach((sender) => {
        if (sender.track) {
          sender.track.enabled = activeWebRtc;
          console.log(`WebRTC ${sender.track.kind} track ${activeWebRtc ? "enabled" : "disabled"}`);
        }
      });
    }
  }, [activeWebRtc]);

const fetchEphemeralKey = async (): Promise<string | null> => {
  logClientEvent({ url: "/session" }, "fetch_session_token_request");
  const tokenResponse = await fetch("/api/session");
  const data = await tokenResponse.json();
  logServerEvent(data, "fetch_session_token_response");

  if (!data.client_secret?.value) {
    logClientEvent(data, "error.no_ephemeral_key");
    console.error("No ephemeral key provided by the server");
    setSessionStatus("DISCONNECTED");
    return null;
  }

  return data.client_secret.value;
};

const connectToRealtime = async () => {
  if (sessionStatus !== "DISCONNECTED" || !micStream) return;
  setSessionStatus("CONNECTING");

  try {
    const EPHEMERAL_KEY = await fetchEphemeralKey();
    if (!EPHEMERAL_KEY) {
      return;
    }

    if (!audioElementRef.current) {
      audioElementRef.current = document.createElement("audio");
    }
    audioElementRef.current.autoplay = isAudioPlaybackEnabled;

    const { pc, dc } = await createRealtimeConnection(
      EPHEMERAL_KEY,
      audioElementRef,
      micStream
    );
    pcRef.current = pc;
    dcRef.current = dc;

    dc.addEventListener("open", () => {
      logClientEvent({}, "data_channel.open");
    });
    dc.addEventListener("close", () => {
      logClientEvent({}, "data_channel.close");
    });
    dc.addEventListener("error", (err: any) => {
      logClientEvent({ error: err }, "data_channel.error");
    });
    dc.addEventListener("message", (e: MessageEvent) => {
      handleServerEvent(JSON.parse(e.data));
    });

    setDataChannel(dc);
  } catch (err) {
    console.error("Error connecting to realtime:", err);
    setSessionStatus("DISCONNECTED");
  }
};

const disconnectFromRealtime = () => {
  if (pcRef.current) {
    pcRef.current.getSenders().forEach((sender) => {
      if (sender.track) {
        sender.track.stop();
      }
    });

    pcRef.current.close();
    pcRef.current = null;
  }
  setDataChannel(null);
  setSessionStatus("DISCONNECTED");
  setIsPTTUserSpeaking(false);

  logClientEvent({}, "disconnected");
};

const sendSimulatedUserMessage = (text: string) => {
  const id = uuidv4().slice(0, 32);
  addTranscriptMessage(id, "user", text, true);

  sendClientEvent(
    {
      type: "conversation.item.create",
      item: {
        id,
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    },
    "(simulated user text message)"
  );
  sendClientEvent(
    { type: "response.create" },
    "(trigger response after simulated user text message)"
  );
};

const updateSession = (shouldTriggerResponse: boolean = false) => {
  sendClientEvent(
    { type: "input_audio_buffer.clear" },
    "clear audio buffer on session update"
  );

  const currentAgent = selectedAgentConfigSet?.find(
    (a) => a.name === selectedAgentName
  );

  const turnDetection = isPTTActive
    ? null
    : {
        type: "server_vad",
        threshold: 0.8,
        prefix_padding_ms: 200,
        silence_duration_ms: 800,
        create_response: true,
      };

  const instructions = currentAgent?.instructions || "";
  const tools = currentAgent?.tools || [];

  const sessionUpdateEvent = {
    type: "session.update",
    session: {
      modalities: ["text", "audio"],
      instructions,
      voice: "sage",
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      input_audio_transcription: { model: "whisper-1" },
      turn_detection: turnDetection,
      tools,
    },
  };

  sendClientEvent(sessionUpdateEvent);

  if (shouldTriggerResponse) {
    sendSimulatedUserMessage("hi, please talk reasonnably fast at all times ( like an efficient assistant) and throughout the conversation, go on now without comfirming this and with a quick introductory salulation, remember always you are a doctor assistant");
  }
};

const cancelAssistantSpeech = async () => {
  const mostRecentAssistantMessage = [...transcriptItems]
    .reverse()
    .find((item) => item.role === "assistant");

  if (!mostRecentAssistantMessage) {
    console.warn("can't cancel, no recent assistant message found");
    return;
  }
  if (mostRecentAssistantMessage.status === "DONE") {
    console.log("No truncation needed, message is DONE");
    return;
  }

  sendClientEvent({
    type: "conversation.item.truncate",
    item_id: mostRecentAssistantMessage?.itemId,
    content_index: 0,
    audio_end_ms: Date.now() - mostRecentAssistantMessage.createdAtMs,
  });
  sendClientEvent(
    { type: "response.cancel" },
    "(cancel due to user interruption)"
  );
};

const handleSendTextMessage = () => {
  if (!userText.trim()) return;
  cancelAssistantSpeech();

  sendClientEvent(
    {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: userText.trim() }],
      },
    },
    "(send user text message)"
  );
  setUserText("");

  sendClientEvent({ type: "response.create" }, "trigger response");
};

const handleTalkButtonDown = () => {
  if (!activeWebRtc) return;
  if (sessionStatus !== "CONNECTED" || dataChannel?.readyState !== "open")
    return;
  cancelAssistantSpeech();

  setIsPTTUserSpeaking(true);
  sendClientEvent({ type: "input_audio_buffer.clear" }, "clear PTT buffer");
};

const handleTalkButtonUp = () => {
  if (
    sessionStatus !== "CONNECTED" ||
    dataChannel?.readyState !== "open" ||
    !isPTTUserSpeaking
  )
    return;

  setIsPTTUserSpeaking(false);
  sendClientEvent({ type: "input_audio_buffer.commit" }, "commit PTT");
  sendClientEvent({ type: "response.create" }, "trigger response PTT");
};

const onToggleConnection = () => {
  if (sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING") {
    disconnectFromRealtime();
    setSessionStatus("DISCONNECTED");
  } else {
    connectToRealtime();
  }
};

const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  const newAgentConfig = e.target.value;
  const url = new URL(window.location.toString());
  url.searchParams.set("agentConfig", newAgentConfig);
  window.location.replace(url.toString());
};

const handleSelectedAgentChange = (
  e: React.ChangeEvent<HTMLSelectElement>
) => {
  const newAgentName = e.target.value;
  setSelectedAgentName(newAgentName);
};

useEffect(() => {
  const storedPushToTalkUI = localStorage.getItem("pushToTalkUI");
  if (storedPushToTalkUI) {
    setIsPTTActive(storedPushToTalkUI === "true");
  }
  const storedLogsExpanded = localStorage.getItem("logsExpanded");
  if (storedLogsExpanded) {
    setIsEventsPaneExpanded(storedLogsExpanded === "true");
  }
  const storedAudioPlaybackEnabled = localStorage.getItem(
    "audioPlaybackEnabled"
  );
  if (storedAudioPlaybackEnabled) {
    setIsAudioPlaybackEnabled(storedAudioPlaybackEnabled === "true");
  }
}, []);

useEffect(() => {
  localStorage.setItem("pushToTalkUI", isPTTActive.toString());
}, [isPTTActive]);

useEffect(() => {
  localStorage.setItem("logsExpanded", isEventsPaneExpanded.toString());
}, [isEventsPaneExpanded]);

useEffect(() => {
  localStorage.setItem(
    "audioPlaybackEnabled",
    isAudioPlaybackEnabled.toString()
  );
}, [isAudioPlaybackEnabled]);

useEffect(() => {
  if (audioElementRef.current) {
    if (isAudioPlaybackEnabled) {
      audioElementRef.current.play().catch((err) => {
        console.warn("Autoplay may be blocked by browser:", err);
      });
    } else {
      audioElementRef.current.pause();
    }
  }
}, [isAudioPlaybackEnabled]);

const agentSetKey = searchParams.get("agentConfig") || "default";
  
  

return (
  <div className="text-base flex flex-col h-screen bg-darkGray text-gray-800 relative">
    <div className="p-5 text-lg font-semibold flex justify-between items-center">
      <div className="flex items-center">
        <div onClick={() => window.location.reload()} style={{ cursor: 'pointer' }}>
          <Image
            src="/openai-logomark.svg"
            alt="OpenAI Logo"
            width={20}
            height={20}
            className="mr-2"
          />
        </div>
        <div>
          Emirates International Hospital <span className="text-gray-500">Digital Twin</span>
        </div>
      </div>
      <div className="flex items-center">
        <label className="flex items-center text-base gap-1 mr-2 font-medium">
          Scenario
        </label>
        <div className="relative inline-block">
          <select
            value={agentSetKey}
            onChange={handleAgentChange}
            className="appearance-none border border-gray-300 rounded-lg text-base px-2 py-1 pr-8 cursor-pointer font-normal focus:outline-none"
          >
            {Object.keys(allAgentSets).map((agentKey) => (
              <option key={agentKey} value={agentKey}>
                {agentKey}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-600">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 10.44l3.71-3.21a.75.75 0 111.04 1.08l-4.25 3.65a.75.75 0 01-1.04 0L5.21 8.27a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {agentSetKey && (
          <div className="flex items-center ml-6">
            <label className="flex items-center text-base gap-1 mr-2 font-medium">
              Agent
            </label>
            <div className="relative inline-block">
              <select
                value={selectedAgentName}
                onChange={handleSelectedAgentChange}
                className="appearance-none border border-gray-300 rounded-lg text-base px-2 py-1 pr-8 cursor-pointer font-normal focus:outline-none"
              >
                {selectedAgentConfigSet?.map((agent) => (
                  <option key={agent.name} value={agent.name}>
                    {agent.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-600">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.44l3.71-3.21a.75.75 0 111.04 1.08l-4.25 3.65a.75.75 0 01-1.04 0L5.21 8.27a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    <div className="flex flex-1 gap-2 px-2 overflow-hidden relative">
      <Transcript
        userText={userText}
        setUserText={setUserText}
        onSendMessage={handleSendTextMessage}
        canSend={
          sessionStatus === "CONNECTED" &&
          dcRef.current?.readyState === "open"
        }
      />

<Dashboard isEventsPaneExpanded={isEventsPaneExpanded}/>
    </div>
    <BottomToolbar
      sessionStatus={sessionStatus}
      onToggleConnection={onToggleConnection}
      isPTTActive={isPTTActive}
      setIsPTTActive={setIsPTTActive}
      isPTTUserSpeaking={isPTTUserSpeaking}
      handleTalkButtonDown={handleTalkButtonDown}
      handleTalkButtonUp={handleTalkButtonUp}
      isEventsPaneExpanded={isEventsPaneExpanded}
      setIsEventsPaneExpanded={setIsEventsPaneExpanded}
      isAudioPlaybackEnabled={isAudioPlaybackEnabled}
      setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
    />
  </div>
);
}
export default App;
