import { Message } from '@/lib/models/conversation';
import { Message as ClientMessage } from '@/lib/claude';

/**
 * Builds a flat conversation history from a tree structure following a specific path
 * @param messages - All messages in the conversation
 * @param activePath - Array of message IDs representing the active branch
 * @returns Array of messages in the correct order for the active branch
 */
export function buildConversationHistory(
  messages: Record<string, any>,
  activePath: string[]
): ClientMessage[] {
  if (!activePath.length) return [];
  
  const history: ClientMessage[] = [];
  let currentId = activePath[0]; // Start with the root message
  
  // Follow the path to build the conversation history
  for (let i = 0; i < activePath.length; i++) {
    const messageId = activePath[i];
    const message = messages[messageId];
    
    if (!message) {
      console.error(`Message with ID ${messageId} not found`);
      break;
    }
    
    history.push({
      messageId: message.messageId,
      role: message.role,
      content: message.content,
      parentId: message.parentId,
      children: message.children,
    });
  }
  
  return history;
}

/**
 * Gets all messages in a conversation as a map for easy access
 * @param conversationId - The ID of the conversation
 * @returns Object mapping message IDs to message objects
 */
export async function getMessageMap(conversationId: string): Promise<Record<string, any>> {
  try {
    const response = await fetch(`/api/conversations/${conversationId}/messages`);
    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }
    
    const messages = await response.json();
    const messageMap: Record<string, any> = {};
    
    messages.forEach((message: any) => {
      messageMap[message.messageId] = message;
    });
    
    return messageMap;
  } catch (error) {
    console.error('Error fetching message map:', error);
    return {};
  }
}

/**
 * Finds the next message ID in the active path based on the parent ID
 * @param messages - Map of all messages
 * @param parentId - ID of the parent message
 * @param activePath - Current active path
 * @returns The ID of the next message in the active path, or null if not found
 */
export function findNextMessageInPath(
  messages: Record<string, any>,
  parentId: string,
  activePath: string[]
): string | null {
  const parentIndex = activePath.indexOf(parentId);
  if (parentIndex >= 0 && parentIndex < activePath.length - 1) {
    return activePath[parentIndex + 1];
  }
  return null;
}

/**
 * Gets all available branches from a specific message
 * @param messages - Map of all messages
 * @param messageId - ID of the message to get branches from
 * @returns Array of message IDs representing the available branches
 */
export function getAvailableBranches(
  messages: Record<string, any>,
  messageId: string
): string[] {
  const message = messages[messageId];
  if (!message) return [];
  
  return message.children || [];
}