-- Persistent Ask Kairos conversations

CREATE TYPE "ConversationMessageRole" AS ENUM ('USER', 'ASSISTANT');
CREATE TYPE "ConversationMessageStatus" AS ENUM ('COMPLETED', 'FAILED');

CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ConversationMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "ConversationMessageStatus" NOT NULL DEFAULT 'COMPLETED',
    "citations" JSONB,
    "insufficientEvidence" BOOLEAN,
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversations_userId_updatedAt_idx" ON "conversations"("userId", "updatedAt" DESC);

CREATE INDEX "conversation_messages_conversationId_createdAt_idx" ON "conversation_messages"("conversationId", "createdAt");

CREATE UNIQUE INDEX "conversation_messages_conversationId_clientRequestId_key" ON "conversation_messages"("conversationId", "clientRequestId");

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
