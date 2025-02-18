import React, { useEffect } from 'react';
import { useAudioConnection } from '../hooks/useAudioConnection';
import { useGlobalFlag } from '../contexts/GlobalFlagContext';
import { useLanguage } from '../contexts/LanguageContext';

export function AudioHandler() {
  const { micStream, parallelConnection } = useGlobalFlag();
  const { doctorLanguage, patientLanguage } = useLanguage();

  // Use the hook - it will automatically start connections when parallelConnection is true
  const {
    doctorToPatientBuffer,
    patientToDoctorBuffer,
    sessionStatusDoctorToPatient,
    sessionStatusPatientToDoctor,
    startParallelConnections, // Only needed if you want to manually trigger connections
    cleanupConnections      // Useful for cleanup or manual disconnection
  } = useAudioConnection({
    micStream,
    doctorLanguage,
    patientLanguage,
    parallelConnection
  });

  // Example: Monitor connection status changes
  useEffect(() => {
    console.log('Doctor to Patient connection status:', sessionStatusDoctorToPatient);
    console.log('Patient to Doctor connection status:', sessionStatusPatientToDoctor);
  }, [sessionStatusDoctorToPatient, sessionStatusPatientToDoctor]);

  // Example: Access buffer contents
  const handleProcessAudio = () => {
    if (doctorToPatientBuffer.current) {
      const audioBlob = doctorToPatientBuffer.current.getAudioBlob();
      // Process the audio blob...
    }

    if (patientToDoctorBuffer.current) {
      const audioBlob = patientToDoctorBuffer.current.getAudioBlob();
      // Process the audio blob...
    }
  };

  // Example: Manual cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupConnections();
    };
  }, [cleanupConnections]);

  return (
    <div>
      <div>Doctor to Patient Status: {sessionStatusDoctorToPatient}</div>
      <div>Patient to Doctor Status: {sessionStatusPatientToDoctor}</div>
      <button onClick={handleProcessAudio}>Process Audio</button>
    </div>
  );
}
