import React from 'react';

interface TypingIndicatorProps {
  users: string[];
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ users }) => {
  if (!users || users.length === 0) return null;

  const label =
    users.length === 1
      ? `${users[0]} is typing...`
      : users.length === 2
      ? `${users[0]} and ${users[1]} are typing...`
      : `${users[0]} and ${users.length - 1} others are typing...`;

  return (
    <div className="flex items-center space-x-2 text-xs text-gray-500 italic px-4 py-1">
      <div className="flex space-x-1">
        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
      </div>
      <span>{label}</span>
    </div>
  );
};
