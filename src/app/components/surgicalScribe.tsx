"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { usePatientData } from "@/app/contexts/PatientDataContext";
import Message from "@/app/components/message";

export default function SurgicalScribePage() {
  const { patientData } = usePatientData();

  // Initialize the chat hook with our API endpoint and an explicit id.
  const { messages, input, setInput, handleInputChange, handleSubmit } = useChat({
    api: "/api/scribe",
    id: "surgical-scribe",
  });

  // References for form and scrolling.
  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Use a ref to store the last submitted patient data.
  const lastSubmitted = useRef<string | null>(null);

  // Whenever patientData changes (and is different from the last submission), trigger a new submission.
  useEffect(() => {
    if (patientData?.content && patientData.content !== lastSubmitted.current) {
      console.log("Submitting new patient data via hidden form:", patientData.content);
      setInput(patientData.content);
      // Use a short timeout to ensure state updates propagate.
      setTimeout(() => {
        formRef.current?.requestSubmit();
        lastSubmitted.current = patientData.content;
      }, 0);
    }
  }, [patientData?.content, setInput]);

  // Auto-scroll to bottom when messages update.
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    // Use "relative" positioning so that this container is limited to its parent's area.
    <div className="relative h-full w-full bg-black">
      <div className="container h-full w-full flex flex-col py-8">
        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          {messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
        </div>
        {/* Hidden form: rendered off-screen but still in the DOM for submission */}
        <form
          onSubmit={handleSubmit}
          ref={formRef}
          style={{
            position: "absolute",
            left: "-9999px",
            opacity: 0,
            pointerEvents: "none",
          }}
        >
          <input
            name="input"
            value={input}
            onChange={handleInputChange}
            placeholder="Hidden input"
          />
        </form>
      </div>
    </div>
  );
}