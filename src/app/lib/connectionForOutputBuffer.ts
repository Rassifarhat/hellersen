

import { AudioBuffer } from "@/app/types";

export const connectionForOutputBuffer = async (
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