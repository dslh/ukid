'use client';

import { useEffect, useState } from 'react';
import ChatContainer from '@/components/ChatContainer';
import ConversationList from '@/components/ConversationList';

interface Conversation {
  _id: string;
  title: string;
  updatedAt: string;
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await fetch('/api/conversations');
        if (response.ok) {
          const data = await response.json();
          setConversations(data);
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();
  }, []);

  const handleDeleteConversation = async (id: string) => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversationId: id }),
      });

      if (response.ok) {
        setConversations((prev) => prev.filter((conv) => conv._id !== id));
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  return (
    <>
      <ConversationList 
        conversations={conversations} 
        onDelete={handleDeleteConversation} 
      />
      <div className="flex-grow">
        <ChatContainer />
      </div>
    </>
  );
}
