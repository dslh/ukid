import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { Message } from '@/lib/claude';
import { buildConversationHistory, getAvailableBranches } from '@/lib/conversationTree';

interface ChatContainerProps {
  initialConversation?: {
    _id: string;
    title: string;
    rootMessageId: string;
    activePath: string[];
    messages: Record<string, Message>;
  };
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  initialConversation,
}) => {
  const [messages, setMessages] = useState<Record<string, Message>>(initialConversation?.messages || {});
  const [activePath, setActivePath] = useState<string[]>(initialConversation?.activePath || []);
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(initialConversation?._id);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Build the active conversation history from the tree
  const activeConversation = useMemo(() => {
    return buildConversationHistory(messages, activePath);
  }, [messages, activePath]);

  // Scroll to bottom whenever active conversation changes
  useEffect(() => {
    scrollToBottom();
  }, [activeConversation]);

  // Update state when props change
  useEffect(() => {
    if (initialConversation) {
      setMessages(initialConversation.messages || {});
      setActivePath(initialConversation.activePath || []);
      setCurrentConversationId(initialConversation._id);
    }
  }, [initialConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle editing a user message
  const handleEditMessage = async (messageId: string, newContent: string) => {
    // Find the message in the active path
    const messageIndex = activePath.indexOf(messageId);
    if (messageIndex === -1 || !currentConversationId) return;

    setIsLoading(true);

    try {
      // Create a new message with the edited content
      const response = await fetch(`/api/conversations/${currentConversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'user',
          content: newContent,
          parentId: messages[messageId].parentId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to edit message');
      }

      const newUserMessage = await response.json();

      // Update the messages map
      setMessages(prev => ({
        ...prev,
        [newUserMessage.messageId]: newUserMessage,
      }));

      // Update the parent's children array
      if (newUserMessage.parentId) {
        const parentMessage = messages[newUserMessage.parentId];
        if (parentMessage) {
          setMessages(prev => ({
            ...prev,
            [parentMessage.messageId]: {
              ...parentMessage,
              children: [...(parentMessage.children || []), newUserMessage.messageId],
            },
          }));
        }
      }

      // Create a new active path that includes the new message
      const newActivePath = [
        ...activePath.slice(0, messageIndex),
        newUserMessage.messageId,
      ];

      // Update the active path in the database
      await fetch(`/api/conversations/${currentConversationId}/activePath`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activePath: newActivePath,
        }),
      });

      // Update local state
      setActivePath(newActivePath);

      // Now generate a new assistant response
      await handleSendMessage(newContent, newUserMessage.messageId, true);
    } catch (error) {
      console.error('Error editing message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle re-rolling an assistant message
  const handleRerollMessage = async (messageId: string) => {
    // Find the message in the active path
    const messageIndex = activePath.indexOf(messageId);
    if (messageIndex === -1 || !currentConversationId) return;

    // Get the parent message (user message)
    const assistantMessage = messages[messageId];
    if (!assistantMessage || !assistantMessage.parentId) return;

    const userMessageId = assistantMessage.parentId;
    const userMessage = messages[userMessageId];
    if (!userMessage) return;

    setIsLoading(true);

    try {
      // Get the conversation history up to the user message
      const historyToUser = buildConversationHistory(
        messages,
        activePath.slice(0, activePath.indexOf(userMessageId) + 1)
      );

      // Prepare messages for API
      const messagesToSend = historyToUser.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Set up SSE connection for re-roll
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesToSend,
          conversationId: currentConversationId,
          parentMessageId: userMessageId,
          isReroll: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to re-roll message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let newAssistantMessage = '';
      let newMessageId = '';

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
              
              // Check if it's the end of the stream
              if (data === '[DONE]') {
                break;
              }
              
              try {
                const parsedData = JSON.parse(data);
                
                // Handle message ID
                if (parsedData.messageId) {
                  newMessageId = parsedData.messageId;
                }
                
                // Handle active path update
                if (parsedData.activePath) {
                  setActivePath(parsedData.activePath);
                }
                
                // Handle content chunk
                if (parsedData.chunk) {
                  newAssistantMessage += parsedData.chunk;
                  
                  // Update the messages map with the new content
                  if (newMessageId) {
                    setMessages(prev => ({
                      ...prev,
                      [newMessageId]: {
                        messageId: newMessageId,
                        role: 'assistant',
                        content: newAssistantMessage,
                        parentId: userMessageId,
                        children: [],
                      },
                    }));
                  }
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error re-rolling message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle selecting a different branch
  const handleBranchSelect = async (messageId: string, branchIndex: number) => {
    if (!currentConversationId) return;
    
    // Find the message in the active path
    const messageIndex = activePath.indexOf(messageId);
    if (messageIndex === -1) return;
    
    // Get available branches for this message
    const branches = getAvailableBranches(messages, messageId);
    if (branchIndex < 0 || branchIndex >= branches.length) return;
    
    // Get the selected branch
    const selectedBranchId = branches[branchIndex];
    
    // Create a new active path that follows this branch
    const newActivePath = [
      ...activePath.slice(0, messageIndex + 1),
      selectedBranchId,
    ];
    
    // If the selected branch has children, add the first child to the path
    const selectedBranch = messages[selectedBranchId];
    if (selectedBranch && selectedBranch.children && selectedBranch.children.length > 0) {
      newActivePath.push(selectedBranch.children[0]);
    }
    
    try {
      // Update the active path in the database
      await fetch(`/api/conversations/${currentConversationId}/activePath`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activePath: newActivePath,
        }),
      });
      
      // Update local state
      setActivePath(newActivePath);
    } catch (error) {
      console.error('Error selecting branch:', error);
    }
  };

  const handleSendMessage = async (content: string, parentId?: string, skipUIUpdate = false) => {
    // If not skipping UI update, add user message to the UI immediately
    if (!skipUIUpdate) {
      const tempId = `temp-${Date.now()}`;
      const userMessage: Message = { 
        messageId: tempId,
        role: 'user', 
        content,
        parentId: parentId || (activePath.length > 0 ? activePath[activePath.length - 1] : null),
      };
      
      // Add to messages map
      setMessages(prev => ({
        ...prev,
        [tempId]: userMessage,
      }));
      
      // Update active path temporarily
      setActivePath(prev => [...prev, tempId]);
    }
    
    setIsLoading(true);

    try {
      // Determine the parent message ID
      const effectiveParentId = parentId || (activePath.length > 0 ? activePath[activePath.length - 1] : null);
      
      // Prepare messages for API
      const messagesToSend = buildConversationHistory(
        messages,
        effectiveParentId ? [...activePath.filter(id => id !== 'temp'), effectiveParentId] : activePath.filter(id => id !== 'temp')
      );
      
      // Add the new user message
      messagesToSend.push({
        role: 'user',
        content,
      });

      // Set up SSE connection
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesToSend.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          conversationId: currentConversationId,
          parentMessageId: effectiveParentId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let userMessageId = '';
      let assistantMessageId = '';

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
              
              // Check if it's the end of the stream
              if (data === '[DONE]') {
                break;
              }
              
              try {
                const parsedData = JSON.parse(data);
                
                // Handle conversation ID
                if (parsedData.conversationId && !currentConversationId) {
                  setCurrentConversationId(parsedData.conversationId);
                  // Update URL if this is a new conversation
                  router.push(`/conversation/${parsedData.conversationId}`, { scroll: false });
                }
                
                // Handle user message ID
                if (parsedData.userMessageId) {
                  userMessageId = parsedData.userMessageId;
                  
                  // If we had a temporary message, replace it with the real one
                  if (!skipUIUpdate) {
                    setMessages(prev => {
                      const newMessages = { ...prev };
                      // Remove the temporary message
                      const tempKeys = Object.keys(newMessages).filter(key => key.startsWith('temp-'));
                      tempKeys.forEach(key => {
                        delete newMessages[key];
                      });
                      return newMessages;
                    });
                    
                    // Update active path to remove temporary ID
                    setActivePath(prev => prev.filter(id => !id.startsWith('temp-')));
                  }
                }
                
                // Handle assistant message ID
                if (parsedData.messageId) {
                  assistantMessageId = parsedData.messageId;
                }
                
                // Handle active path update
                if (parsedData.activePath) {
                  setActivePath(parsedData.activePath);
                }
                
                // Handle content chunk
                if (parsedData.chunk) {
                  assistantMessage += parsedData.chunk;
                  
                  // Update the messages map with the new content
                  if (assistantMessageId) {
                    setMessages(prev => ({
                      ...prev,
                      [assistantMessageId]: {
                        messageId: assistantMessageId,
                        role: 'assistant',
                        content: assistantMessage,
                        parentId: userMessageId || effectiveParentId,
                        children: [],
                      },
                    }));
                    
                    // If we have the user message ID, update it with the assistant as a child
                    if (userMessageId) {
                      setMessages(prev => {
                        const userMsg = prev[userMessageId];
                        if (userMsg) {
                          return {
                            ...prev,
                            [userMessageId]: {
                              ...userMsg,
                              children: [...(userMsg.children || []), assistantMessageId],
                            },
                          };
                        }
                        return prev;
                      });
                    }
                  }
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
      const errorId = `error-${Date.now()}`;
      setMessages(prev => ({
        ...prev,
        [errorId]: {
          messageId: errorId,
          role: 'assistant',
          content: 'Sorry, there was an error processing your request.',
          parentId: activePath[activePath.length - 1],
          children: [],
        },
      }));
      
      // Update active path to include error message
      setActivePath(prev => [...prev.filter(id => !id.startsWith('temp-')), errorId]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-grow overflow-y-auto p-4">
        {activeConversation.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <h2 className="text-2xl font-bold mb-2">Chat with Claude 3.7 Sonnet</h2>
              <p>Send a message to start a conversation</p>
            </div>
          </div>
        ) : (
          activeConversation.map((message, index) => {
            // Find available branches for this message
            const availableBranches = message.messageId ? 
              (messages[message.messageId]?.children || []) : [];
            
            // Find the current branch index if this message has multiple children
            let currentBranchIndex = 0;
            if (message.messageId && index < activeConversation.length - 1) {
              const nextMessageId = activeConversation[index + 1].messageId;
              if (nextMessageId) {
                currentBranchIndex = availableBranches.indexOf(nextMessageId);
                if (currentBranchIndex === -1) currentBranchIndex = 0;
              }
            }
            
            return (
              <ChatMessage 
                key={message.messageId || index}
                message={message}
                onEdit={handleEditMessage}
                onReroll={handleRerollMessage}
                onBranchSelect={handleBranchSelect}
                availableBranches={availableBranches}
                currentBranchIndex={currentBranchIndex}
                isInActivePath={true}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
};

export default ChatContainer;