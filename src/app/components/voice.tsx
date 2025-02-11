"use client";

import { cn } from "../utils/cn";
import { useState, useEffect, useRef } from "react";
import { MdSettingsVoice } from "react-icons/md";
import { useGlobalFlag } from "@/app/contexts/GlobalFlagContext";

interface VoiceProps {
  onVoice: (value: string) => void;
  onToggleLoading: (isLoading: boolean) => void;
  className?: string;
}

export default function Voice({ onVoice, onToggleLoading, className }: VoiceProps) {
  // We no longer call navigator.mediaDevices.getUserMedia here.
  // Instead, we consume the micStream + activeWebRtc from the context:
  const { activeWebRtc, micStream } = useGlobalFlag();

  const [result, setResult] = useState<string | undefined>();
  const [recording, setRecording] = useState<boolean>(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  // We'll store audio chunks in a ref so we don't lose them between renders.
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (activeWebRtc || !micStream) {
    console.log("Stopping media recorder due to WebRTC being active or micStream being null");
      return;
    }

    if (!micStream) return;
const recordingStream = new MediaStream(
  micStream.getAudioTracks().map((track) => {
    const cloned = track.clone();
    // Ensure the cloned track is enabled for recording.
    cloned.enabled = true;
    return cloned;
  })
);
const newMediaRecorder = new MediaRecorder(recordingStream);

    newMediaRecorder.onstart = () => {
      console.log("Recording started");
      chunksRef.current = [];
    };

    newMediaRecorder.ondataavailable = (e: BlobEvent) => {
      console.log("Data available and being stored");
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    newMediaRecorder.onstop = async () => {
      console.log("Recording stopped");
      if (chunksRef.current.length === 0) {
        console.log("No audio data available for transcription");
        return;
      }

      const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
      try {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async function () {
          onToggleLoading(true);
          const base64Audio: string = (reader.result as string).split(",")[1];

          try {
            const response = await fetch("/api/speechToText", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ audio: base64Audio }),
            });

            const data = await response.json();
            
            if (response.status !== 200) {
              throw data.error || new Error(`Request failed with status ${response.status}`);
            }
            
            setResult(data.result);
            onVoice(data.result);
            console.log("Audio processing complete: ", data.result);
          } finally {
            onToggleLoading(false);
          }
        };
      } catch (error: any) {
        console.error("Error processing audio:", error);
        onToggleLoading(false);
      }
    };

    setMediaRecorder(newMediaRecorder);

    return () => {
      if (newMediaRecorder.state === 'recording') {
        newMediaRecorder.stop();
        setRecording(false);
      }
    };
  }, [activeWebRtc, micStream]); // Include micStream in dependencies

  const startRecording = () => {
    if (!mediaRecorder || mediaRecorder.state === "recording" || activeWebRtc || !micStream) return;
    
    try {
      mediaRecorder.start();
      setRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const stopRecording = () => {
    if (!mediaRecorder || mediaRecorder.state !== "recording") return;
    try {
      mediaRecorder.stop();
      setRecording(false);
    } catch (error) {
      console.error("Error stopping recording:", error);
      setRecording(false);
    }
  };

  // Don't render anything if WebRTC is active
  if (activeWebRtc) {
    return null;
  }

  return (
    <div className={className}>
      <button
        onClick={recording ? stopRecording : startRecording}
        disabled={!micStream || activeWebRtc}
        className={cn(
          "rounded-full",
          recording
            ? "relative w-full inline-flex h-12 overflow-hidden p-[5px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50"
            : "w-full inline-flex h-12 animate-shimmer items-center justify-center border border-slate-100 bg-[linear-gradient(110deg,#000103,45%,#7e8691,55%,#000103)] bg-[length:200%_100%] px-6 font-medium text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50"
        )}
      >
        {recording ? (
          <span className="absolute inset-[-3000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
        ) : null}

        {recording ? (
          <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-mildred px-3 py-1 text-sm font-medium text-white backdrop-blur-3xl">
            <MdSettingsVoice className="w-6 h-6 text-white mr-2" />
            <span className="text-white">Recording Ongoing ...</span>
          </span>
        ) : (
          <span className="flex items-center">
            <MdSettingsVoice className="hover:text-red-500 w-6 h-6 text-green-500 mr-2" />
            <span className="hover:text-red-500 text-white">Click to start recording</span>
          </span>
        )}
      </button>
    </div>
  );
}