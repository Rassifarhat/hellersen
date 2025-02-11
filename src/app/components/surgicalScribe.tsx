"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { usePatientData } from "@/app/contexts/PatientDataContext";
import Message from "@/app/components/message";

export default function SurgicalScribePage() {
  // Get patient data from context
  const { patientData } = usePatientData();

  // Initialize the chat hook with our API endpoint and an explicit id.
  const { messages, append } = useChat({
    api: "/api/scribe",
    id: "surgical-scribe",
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  // Use a ref to track the last submitted patient data content.
  const lastSubmitted = useRef<string | null>(null);

  // Whenever patientData.content changes and is different from lastSubmitted, trigger a new submission.
  useEffect(() => {
    if (patientData?.content && patientData.content !== lastSubmitted.current) {
      console.log("Appending new patient data via hidden submission:", patientData.content);
      append({ content: patientData.content, role: "user" });
      lastSubmitted.current = patientData.content;
    }
  }, [patientData?.content, append]);

  // Auto-scroll when messages update.
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="relative h-full w-full bg-black">
      <div className="container h-full w-full flex flex-col py-8">
        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          {messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
        </div>
      </div>
    </div>
  );
}