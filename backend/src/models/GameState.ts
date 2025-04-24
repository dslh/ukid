import mongoose, { Schema, Document } from 'mongoose';

export interface IGameState extends Document {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const GameStateSchema = new Schema<IGameState>(
  {
    messages: [
      {
        role: { type: String, enum: ['user', 'assistant'], required: true },
        content: { type: String, required: true }
      }
    ]
  },
  {
    timestamps: true
  }
);

export const GameState = mongoose.model<IGameState>('GameState', GameStateSchema); 