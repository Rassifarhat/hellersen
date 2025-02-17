import { useCallback, useRef, useEffect, useState } from 'react';
import { SessionStatus, AudioBuffer } from '@/app/types';
import { createRealtimeConnection } from '../lib/realtimeConnection';

interface UseAudioConnectionParams {
  micStream: MediaStream | null;
  doctorLanguage: string | null;
  patientLanguage: string | null;
  parallelConnection: boolean;
}

interface UseAudioConnectionReturn {
  sessionStatusDoctorToPatient: SessionStatus;
  sessionStatusPatientToDoctor: SessionStatus;
  doctorToPatientBuffer: React.RefObject<AudioBuffer>;
  patientToDoctorBuffer: React.RefObject<AudioBuffer>;
  startParallelConnections: () => Promise<void>;
  cleanupConnections: () => void;
}

export function useAudioConnection({
  micStream,
  doctorLanguage,
  patientLanguage,
  parallelConnection,
}: UseAudioConnectionParams): UseAudioConnectionReturn {
  // Connection refs
  const pcDoctorToPatientRef = useRef<RTCPeerConnection | null>(null);
  const dcDoctorToPatientRef = useRef<RTCDataChannel | null>(null);
  const pcPatientToDoctorRef = useRef<RTCPeerConnection | null>(null);
  const dcPatientToDoctorRef = useRef<RTCDataChannel | null>(null);

  // Buffer refs
  const doctorToPatientBuffer = useRef<AudioBuffer>({
    chunks: [],
    addChunk: (chunk: Blob) => {
      doctorToPatientBuffer.current.chunks.push(chunk);
    },
    clear: () => {
      doctorToPatientBuffer.current.chunks = [];
    },
    getAudioBlob: () => new Blob(doctorToPatientBuffer.current.chunks),
  });

  const patientToDoctorBuffer = useRef<AudioBuffer>({
    chunks: [],
    addChunk: (chunk: Blob) => {
      patientToDoctorBuffer.current.chunks.push(chunk);
    },
    clear: () => {
      patientToDoctorBuffer.current.chunks = [];
    },
    getAudioBlob: () => new Blob(patientToDoctorBuffer.current.chunks),
  });

  // Connection status
  const [sessionStatusDoctorToPatient, setSessionStatusDoctorToPatient] = useState<SessionStatus>("DISCONNECTED");
  const [sessionStatusPatientToDoctor, setSessionStatusPatientToDoctor] = useState<SessionStatus>("DISCONNECTED");

  const connectAgentSession = useCallback(async (
    sessionType: string,
    buffer: React.RefObject<AudioBuffer>,
    pcRef: React.RefObject<RTCPeerConnection>,
    dcRef: React.RefObject<RTCDataChannel>,
    setSessionStatusLocal: (status: SessionStatus) => void
  ) => {
    try {
      if (!micStream) {
        throw new Error("No microphone stream available");
      }

      const { pc, dc } = await createRealtimeConnection(micStream);
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
        setSessionStatusLocal("DISCONNECTED");
        pcRef.current = null;
        dcRef.current = null;
      });

      setSessionStatusLocal("CONNECTED");
    } catch (err) {
      console.error(`[${sessionType}] Connection error:`, err);
      setSessionStatusLocal("DISCONNECTED");
    }
  }, [micStream]);

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
      cleanupConnections();
    }
  }, [
    micStream,
    doctorLanguage,
    patientLanguage,
    sessionStatusDoctorToPatient,
    sessionStatusPatientToDoctor,
    connectAgentSession,
  ]);

  const cleanupConnections = useCallback(() => {
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
  }, []);

  // Effect to handle parallel connections
  useEffect(() => {
    if (parallelConnection && doctorLanguage && patientLanguage) {
      startParallelConnections();
    }
  }, [parallelConnection, doctorLanguage, patientLanguage, startParallelConnections]);

  // Effect to cleanup parallel connections when disabled
  useEffect(() => {
    if (!parallelConnection) {
      console.log("🔄 Cleaning up parallel connections");
      cleanupConnections();
    }
  }, [parallelConnection, cleanupConnections]);

  return {
    sessionStatusDoctorToPatient,
    sessionStatusPatientToDoctor,
    doctorToPatientBuffer,
    patientToDoctorBuffer,
    startParallelConnections,
    cleanupConnections,
  };
}
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
