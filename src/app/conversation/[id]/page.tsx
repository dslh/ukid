'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ChatContainer from '@/components/ChatContainer';
import ConversationList from '@/components/ConversationList';
import { Message } from '@/lib/claude';

interface Conversation {
  _id: string;
  title: string;
  updatedAt: string;
  messages: Message[];
}

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.id as string;
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
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
      }
    };

    fetchConversations();
  }, []);

  useEffect(() => {
    const fetchConversation = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/conversations/${conversationId}`);
        if (response.ok) {
          const data = await response.json();
          setCurrentConversation(data);
        }
      } catch (error) {
        console.error('Error fetching conversation:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (conversationId) {
      fetchConversation();
    }
  }, [conversationId]);

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
        currentId={conversationId}
        onDelete={handleDeleteConversation} 
      />
      <div className="flex-grow">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p>Loading conversation...</p>
          </div>
        ) : (
          <ChatContainer 
            initialMessages={currentConversation?.messages || []} 
            conversationId={conversationId}
          />
        )}
      </div>
    </>
  );
}