import React, { useState } from 'react';
import { Message } from '@/lib/claude';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
  onEdit?: (messageId: string, content: string) => void;
  onReroll?: (messageId: string) => void;
  onBranchSelect?: (messageId: string, branchIndex: number) => void;
  availableBranches?: string[];
  currentBranchIndex?: number;
  isInActivePath: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  onEdit, 
  onReroll, 
  onBranchSelect,
  availableBranches = [],
  currentBranchIndex = 0,
  isInActivePath
}) => {
  const isUser = message.role === 'user';
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const hasBranches = availableBranches.length > 1;
  
  const handleEdit = () => {
    setIsEditing(true);
  };
  
  const handleSaveEdit = () => {
    if (onEdit && message.messageId) {
      onEdit(message.messageId, editedContent);
    }
    setIsEditing(false);
  };
  
  const handleCancelEdit = () => {
    setEditedContent(message.content);
    setIsEditing(false);
  };
  
  const handleReroll = () => {
    if (onReroll && message.messageId) {
      onReroll(message.messageId);
    }
  };
  
  const handleBranchChange = (direction: 'prev' | 'next') => {
    if (!onBranchSelect || !message.messageId) return;
    
    let newIndex = currentBranchIndex;
    if (direction === 'prev') {
      newIndex = (currentBranchIndex - 1 + availableBranches.length) % availableBranches.length;
    } else {
      newIndex = (currentBranchIndex + 1) % availableBranches.length;
    }
    
    onBranchSelect(message.messageId, newIndex);
  };
  
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-4 relative`}>
      {/* Branch navigation buttons */}
      {hasBranches && isInActivePath && (
        <div className="flex mb-1 space-x-2">
          <button 
            onClick={() => handleBranchChange('prev')}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ← Previous
          </button>
          <span className="text-gray-500 text-sm">
            {currentBranchIndex + 1}/{availableBranches.length}
          </span>
          <button 
            onClick={() => handleBranchChange('next')}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Next →
          </button>
        </div>
      )}
      
      {/* Message content */}
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-blue-500 text-white'
            : 'bg-gray-200 text-gray-800'
        }`}
      >
        {isUser ? (
          isEditing ? (
            <div className="flex flex-col">
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full p-2 text-gray-800 rounded mb-2"
                rows={3}
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={handleCancelEdit}
                  className="px-2 py-1 bg-gray-300 text-gray-800 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-2 py-1 bg-green-500 text-white rounded"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="whitespace-pre-wrap">{message.content}</div>
          )
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
      
      {/* Action buttons */}
      {isInActivePath && (
        <div className="mt-1 flex space-x-2">
          {isUser && onEdit && !isEditing && (
            <button
              onClick={handleEdit}
              className="text-xs text-gray-500 hover:text-blue-500"
            >
              Edit
            </button>
          )}
          {!isUser && onReroll && (
            <button
              onClick={handleReroll}
              className="text-xs text-gray-500 hover:text-blue-500"
            >
              Re-roll
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatMessage;