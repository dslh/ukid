import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { Message } from '@/lib/claude';

interface ChatContainerProps {
  initialMessages?: Message[];
  conversationId?: string;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  initialMessages = [],
  conversationId,
}) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(conversationId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update messages and conversationId when props change
  useEffect(() => {
    // Only update if the props have actually changed
    if (JSON.stringify(initialMessages) !== JSON.stringify(messages)) {
      setMessages(initialMessages);
    }
    
    if (conversationId !== currentConversationId) {
      setCurrentConversationId(conversationId);
    }
  }, [initialMessages, conversationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (content: string) => {
    // Add user message to the UI immediately
    const userMessage: Message = { role: 'user', content };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Prepare messages for API
      const messagesToSend = [
        ...messages,
        userMessage,
      ];

      // Set up SSE connection
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesToSend,
          conversationId: currentConversationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      // Add an empty assistant message that we'll update as chunks arrive
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Process the chunk
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              // Check if it's the conversation ID
              if (data.includes('conversationId')) {
                const { conversationId } = JSON.parse(data);
                if (!currentConversationId) {
                  setCurrentConversationId(conversationId);
                  // Update URL if this is a new conversation
                  router.push(`/conversation/${conversationId}`, { scroll: false });
                }
                continue;
              }
              
              // Check if it's the end of the stream
              if (data === '[DONE]') {
                break;
              }
              
              try {
                const { chunk: textChunk } = JSON.parse(data);
                if (textChunk) {
                  assistantMessage += textChunk;
                  
                  // Update the last message with the accumulated text
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = {
                      role: 'assistant',
                      content: assistantMessage,
                    };
                    return newMessages;
                  });
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Show error in UI
      setMessages((prev) => [
        ...prev.slice(0, -1), // Remove the empty assistant message
        { role: 'assistant', content: 'Sorry, there was an error processing your request.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-grow overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <h2 className="text-2xl font-bold mb-2">Chat with Claude 3.7 Sonnet</h2>
              <p>Send a message to start a conversation</p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
};

export default ChatContainer;