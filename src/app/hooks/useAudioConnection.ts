import { useCallback, useRef, useEffect, useState } from 'react';
import { SessionStatus, AudioBuffer } from '@/app/types';
import { connectionForOutputBuffer } from '../lib/connectionForOutputBuffer';

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
    addChunk(chunk: Blob) {
      this.chunks.push(chunk);
    },
    clear() {
      this.chunks = [];
    },
    getAudioBlob() {
      return new Blob(this.chunks);
    }
  });

  const patientToDoctorBuffer = useRef<AudioBuffer>({
    chunks: [],
    addChunk(chunk: Blob) {
      this.chunks.push(chunk);
    },
    clear() {
      this.chunks = [];
    },
    getAudioBlob() {
      return new Blob(this.chunks);
    }
  });

  // Connection status
  const [sessionStatusDoctorToPatient, setSessionStatusDoctorToPatient] = useState<SessionStatus>("DISCONNECTED");
  const [sessionStatusPatientToDoctor, setSessionStatusPatientToDoctor] = useState<SessionStatus>("DISCONNECTED");

  const fetchEphemeralKey = useCallback(async (): Promise<string | null> => {
    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
    return data.client_secret?.value || null;
  }, []);

  const connectAgentSession = useCallback(async (
    sessionType: "doctorToPatient" | "patientToDoctor",
    buffer: React.RefObject<AudioBuffer>,
    pcRef: React.RefObject<RTCPeerConnection | null>,
    dcRef: React.RefObject<RTCDataChannel | null>,
    setSessionStatusLocal: (status: SessionStatus) => void
  ) => {
    try {
      if (!micStream) {
        throw new Error("No microphone stream available");
      }

      const key = await fetchEphemeralKey();
      if (!key) {
        throw new Error("Failed to obtain ephemeral key");
      }

      const { pc, dc } = await connectionForOutputBuffer(
        sessionType,
        key,
        micStream,
        buffer.current
      );

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
  }, [micStream, fetchEphemeralKey]);

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
