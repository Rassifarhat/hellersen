import { useCallback, useRef, useEffect } from 'react';
import { AudioBuffer } from '@/app/types';

interface UseAudioRoutingParams {
  spokenLanguage: string | null;
  doctorLanguage: string | null;
  patientLanguage: string | null;
  parallelConnection: boolean;
  doctorToPatientBuffer: React.RefObject<AudioBuffer>;
  patientToDoctorBuffer: React.RefObject<AudioBuffer>;
  audioElement: HTMLAudioElement;
}

export function useAudioRouting({
  spokenLanguage,
  doctorLanguage,
  patientLanguage,
  parallelConnection,
  doctorToPatientBuffer,
  patientToDoctorBuffer,
  audioElement
}: UseAudioRoutingParams) {
  const audioRef = useRef<HTMLAudioElement>(audioElement);

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

    const isDoctor = spokenLanguage.toLowerCase() === doctorLanguage?.toLowerCase();
    const buffer = isDoctor ? doctorToPatientBuffer.current : patientToDoctorBuffer.current;

    if (!buffer) {
      console.log("❌ Cannot route audio: buffer not found");
      return;
    }

    const audioBlob = buffer.getAudioBlob();
    const audioUrl = URL.createObjectURL(audioBlob);

    audioRef.current.src = audioUrl;
    audioRef.current.play().catch(error => {
      console.error("Error playing audio:", error);
    });

    // Cleanup the URL and both buffers after the audio is done playing
    audioRef.current.onended = () => {
      URL.revokeObjectURL(audioUrl);
      // Clear both buffers since they might both contain data
      doctorToPatientBuffer.current.clear();
      patientToDoctorBuffer.current.clear();
      console.log("🧹 Cleared both audio buffers");
    };
  }, [spokenLanguage, doctorLanguage, patientLanguage, doctorToPatientBuffer, patientToDoctorBuffer]);

  // Effect to handle audio routing when spoken language changes
  useEffect(() => {
    if (spokenLanguage && parallelConnection) {
      routeAudioBuffer();
    }
  }, [spokenLanguage, parallelConnection, routeAudioBuffer]);

  return {
    routeAudioBuffer
  };
}
