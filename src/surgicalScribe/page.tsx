"use client";

import { useChat } from "ai/react";
import React, { useEffect, useRef, useCallback, useState} from "react";
import Voice from "../app/components/voice";
import Message from "../app/components/message";

export default function Home() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, handleSubmit, setInput, input, handleInputChange } = useChat({
    api: '/api/scribe'
  });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    scrollRef?.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  const changeInput = useCallback((value: string) => {
      setInput(value);
      formRef.current?.requestSubmit();
  }, [setInput]);

  return (
    <main className="fixed h-full w-full bg-black">
      <div className="container h-full w-full flex flex-col py-8">
        <div className="flex-1 overflow-y-auto">
          {messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
          <div ref={scrollRef} />
        </div>

        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
          
            
            handleSubmit(e);
          }}
          className="w-full relative p-2"
        >
          <div className="relative">
            <Voice 
              onVoice={changeInput} 
              onToggleLoading={(isLoading) => {}} 
            />
          </div>
          
        </form>
      </div>
    </main>
  );
}