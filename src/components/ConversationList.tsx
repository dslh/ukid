import React from 'react';
import Link from 'next/link';

interface Conversation {
  _id: string;
  title: string;
  updatedAt: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  currentId?: string;
  onDelete: (id: string) => void;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  currentId,
  onDelete,
}) => {
  return (
    <div className="w-64 bg-gray-100 h-screen overflow-y-auto p-4">
      <div className="mb-4">
        <Link
          href="/"
          className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg flex justify-center items-center hover:bg-blue-600"
        >
          New Chat
        </Link>
      </div>
      <div className="space-y-2">
        {conversations.map((conversation) => (
          <div
            key={conversation._id}
            className={`p-2 rounded-lg flex justify-between items-center ${
              currentId === conversation._id
                ? 'bg-blue-100 border border-blue-300'
                : 'hover:bg-gray-200'
            }`}
          >
            <Link
              href={`/conversation/${conversation._id}`}
              className="flex-grow truncate"
            >
              {conversation.title}
            </Link>
            <button
              onClick={() => onDelete(conversation._id)}
              className="ml-2 text-red-500 hover:text-red-700"
              aria-label="Delete conversation"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConversationList;