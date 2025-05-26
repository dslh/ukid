import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMessage extends Document {
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  parentId: string | null;
  children: string[];
  conversationId: string;
  createdAt: Date;
}

export interface IConversation extends Document {
  title: string;
  rootMessageId: string | null;
  activePath: string[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  messageId: {
    type: String,
    required: true,
    default: () => new Types.ObjectId().toString(),
  },
  role: {
    type: String,
    required: true,
    enum: ['user', 'assistant'],
  },
  content: {
    type: String,
    required: true,
  },
  parentId: {
    type: String,
    default: null,
  },
  children: {
    type: [String],
    default: [],
  },
  conversationId: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const ConversationSchema = new Schema<IConversation>({
  title: {
    type: String,
    required: true,
    default: 'New Conversation',
  },
  rootMessageId: {
    type: String,
    default: null,
  },
  activePath: {
    type: [String],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field on save
ConversationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Create a model for messages
export const Message = mongoose.models.Message || 
  mongoose.model<IMessage>('Message', MessageSchema);

export default mongoose.models.Conversation || 
  mongoose.model<IConversation>('Conversation', ConversationSchema);