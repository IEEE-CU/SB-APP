import React, { useState } from 'react';
import DOMPurify from 'dompurify';

interface NoteEditorProps {
  initialTitle?: string;
  initialContent?: string;
  onSave: (title: string, content: string) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  initialTitle = '',
  initialContent = '',
  onSave,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);

  const handleSave = () => {
    // Sanitize HTML with DOMPurify to block XSS vectors before saving
    const sanitizedHtml = DOMPurify.sanitize(content);
    onSave(title, sanitizedHtml);
  };

  return (
    <div className="flex flex-col space-y-3 bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <input
        type="text"
        placeholder="Note Title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-lg font-semibold bg-transparent border-b border-gray-200 dark:border-gray-700 pb-2 focus:outline-none focus:border-blue-500 dark:text-white"
      />
      <textarea
        placeholder="Write note content in HTML/Rich Text format..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={8}
        className="w-full bg-gray-50 dark:bg-gray-900 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
      />
      <div className="flex justify-between items-center pt-2">
        <span className="text-xs text-gray-400">
          Protected with DOMPurify sanitization
        </span>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-md transition"
        >
          Save Note
        </button>
      </div>
    </div>
  );
};
