import React, { useState } from 'react';

interface ChatInputProps {
  placeholder?: string;
  onSendMessage: (text: string) => void;
  onChangeText?: (text: string) => void;
}

export default function ChatInput({
  placeholder = "Write a message...",
  onSendMessage,
  onChangeText
}: ChatInputProps) {
  const [text, setText] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    if (onChangeText) {
      onChangeText(val);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSendMessage(text.trim());
      setText('');
      if (onChangeText) {
        onChangeText('');
      }
    }
  };

  return (
    <form className="chat-input-wrapper" onSubmit={handleSubmit}>
      <input
        type="text"
        className="chat-input-field"
        placeholder={placeholder}
        value={text}
        onChange={handleChange}
      />
      <button type="submit" className="chat-send-btn" aria-label="Send">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
        </svg>
      </button>
    </form>
  );
}
