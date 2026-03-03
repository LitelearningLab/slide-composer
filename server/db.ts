/**
 * Simple in-memory database for chat conversations
 * Used for voice chat and text chat features
 */

interface Conversation {
  id: number;
  title: string;
  createdAt: Date;
}

interface Message {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: Date;
}

class InMemoryDB {
  private conversations: Map<number, Conversation> = new Map();
  private messages: Map<number, Message> = new Map();
  private conversationIdCounter = 1;
  private messageIdCounter = 1;

  selectFromConversations(id?: number) {
    return {
      where: (fn: (conv: Conversation) => boolean) => {
        if (id !== undefined) {
          const conversation = this.conversations.get(id);
          return conversation ? [conversation] : [];
        }
        return Array.from(this.conversations.values()).filter(fn);
      },
      all: () => Array.from(this.conversations.values()),
    };
  }

  selectFromMessages(id?: number) {
    return {
      where: (fn: (msg: Message) => boolean) => {
        if (id !== undefined) {
          const message = this.messages.get(id);
          return message ? [message] : [];
        }
        return Array.from(this.messages.values()).filter(fn);
      },
      all: () => Array.from(this.messages.values()),
    };
  }

  createConversation(title: string): Conversation {
    const id = this.conversationIdCounter++;
    const conversation: Conversation = {
      id,
      title,
      createdAt: new Date(),
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  getConversation(id: number): Conversation | undefined {
    return this.conversations.get(id);
  }

  getAllConversations(): Conversation[] {
    return Array.from(this.conversations.values());
  }

  deleteConversation(id: number): void {
    this.conversations.delete(id);
    // Also delete associated messages
    for (const [msgId, msg] of this.messages.entries()) {
      if (msg.conversationId === id) {
        this.messages.delete(msgId);
      }
    }
  }

  createMessage(conversationId: number, role: string, content: string): Message {
    const id = this.messageIdCounter++;
    const message: Message = {
      id,
      conversationId,
      role,
      content,
      createdAt: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  getMessagesByConversation(conversationId: number): Message[] {
    return Array.from(this.messages.values())
      .filter(msg => msg.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}

export const db = new InMemoryDB();
