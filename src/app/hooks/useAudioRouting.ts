import { useCallback, useRef, useEffect } from 'react';
import { AudioBuffer } from '@/app/types';

interface UseAudioRoutingParams {
  spokenLanguage: string | null;
  doctorLanguage: string | null;
  patientLanguage: string | null;
  parallelConnection: boolean;
  doctorToPatientBuffer: React.RefObject<AudioBuffer>;
  patientToDoctorBuffer: React.RefObject<AudioBuffer>;
}

export function useAudioRouting({
  spokenLanguage,
  doctorLanguage,
  patientLanguage,
  parallelConnection,
  doctorToPatientBuffer,
  patientToDoctorBuffer,
}: UseAudioRoutingParams) {
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    if (!audioElementRef.current) {
      const audioElement = new Audio();
      audioElement.autoplay = false; // We'll control playback manually
      audioElementRef.current = audioElement;
    }
  }, []);

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
  }, [spokenLanguage, doctorLanguage, patientLanguage, parallelConnection, doctorToPatientBuffer, patientToDoctorBuffer]);

  // Effect to handle audio routing when spoken language changes
  useEffect(() => {
    if (spokenLanguage && spokenLanguage !== "unknown") {
      routeAudioBuffer();
    }
  }, [spokenLanguage, routeAudioBuffer]);

  return {
    routeAudioBuffer,
  };
}
