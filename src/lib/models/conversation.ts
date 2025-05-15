import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface IConversation extends Document {
  title: string;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  role: {
    type: String,
    required: true,
    enum: ['user', 'assistant'],
  },
  content: {
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
  messages: [MessageSchema],
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

export default mongoose.models.Conversation || 
  mongoose.model<IConversation>('Conversation', ConversationSchema);