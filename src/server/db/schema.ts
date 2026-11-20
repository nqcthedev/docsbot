import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/**
 * All embeddings are stored at a fixed width so that a single HNSW index can serve every bot.
 * 1536 is native for OpenAI text-embedding-3-small and supported by Gemini gemini-embedding-001
 * via Matryoshka truncation (`dimensions: 1536`). It also stays under pgvector's 2000-dim HNSW limit.
 * The model that produced each vector is stored next to it, and retrieval only ever compares
 * vectors from the same model (see rag/retrieve.ts).
 */
export const EMBEDDING_DIMENSIONS = 1536;

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });
const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (v) => (Buffer.isBuffer(v) ? v : Buffer.from(v)),
});

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the random session token. The raw token only ever lives in the httpOnly cookie. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const bots = pgTable(
  "bots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    welcomeMessage: text("welcome_message").notNull().default("Hi! Ask me anything about our products and policies."),
    fallbackMessage: text("fallback_message")
      .notNull()
      .default("Sorry, I couldn't find that in our documentation. Leave your email and our team will get back to you."),
    brandColor: text("brand_color").notNull().default("#4f46e5"),
    instructions: text("instructions").notNull().default(""),
    chatModel: text("chat_model").notNull(),
    temperature: real("temperature").notNull().default(0.2),
    /** Minimum cosine similarity of the best retrieved chunk. Below it the bot declines instead of guessing. */
    minSimilarity: real("min_similarity").notNull().default(0.6),
    topK: integer("top_k").notNull().default(6),
    allowedDomains: text("allowed_domains").array().notNull().default(sql`'{}'::text[]`),
    leadCaptureEnabled: boolean("lead_capture_enabled").notNull().default(true),
    /** Set on first successful ingestion; used to detect embedding-model changes that require re-indexing. */
    embeddingModel: text("embedding_model"),
    embeddingDimensions: integer("embedding_dimensions"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("bots_workspace_idx").on(t.workspaceId)],
);

export const sourceType = pgEnum("source_type", ["website", "pdf", "text"]);
export const sourceStatus = pgEnum("source_status", ["pending", "processing", "ready", "error"]);

export type SourceProgress = { stage: string; done: number; total: number | null; message?: string };
export type WebsiteConfig = { maxPages: number };

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    botId: uuid("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    type: sourceType("type").notNull(),
    name: text("name").notNull(),
    url: text("url"),
    config: jsonb("config").$type<WebsiteConfig | Record<string, never>>().notNull().default({}),
    fileName: text("file_name"),
    fileData: bytea("file_data"),
    fileSize: integer("file_size"),
    textContent: text("text_content"),
    status: sourceStatus("status").notNull().default("pending"),
    error: text("error"),
    progress: jsonb("progress").$type<SourceProgress | null>(),
    documentCount: integer("document_count").notNull().default(0),
    chunkCount: integer("chunk_count").notNull().default(0),
    tokenCount: integer("token_count").notNull().default(0),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sources_bot_idx").on(t.botId), index("sources_status_idx").on(t.status)],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    botId: uuid("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url"),
    /** 1-based page number for PDF documents. */
    page: integer("page"),
    contentHash: text("content_hash").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("documents_source_idx").on(t.sourceId)],
);

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    botId: uuid("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    content: text("content").notNull(),
    headingPath: text("heading_path").notNull().default(""),
    tokenCount: integer("token_count").notNull(),
    contentHash: text("content_hash").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    embeddingModel: text("embedding_model").notNull(),
    tsv: tsvector("tsv")
      .notNull()
      .generatedAlwaysAs(sql`to_tsvector('english', coalesce(heading_path, '') || ' ' || content)`),
    createdAt: createdAt(),
  },
  (t) => [
    index("chunks_bot_idx").on(t.botId, t.embeddingModel),
    index("chunks_hash_idx").on(t.botId, t.contentHash),
    index("chunks_embedding_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("chunks_tsv_gin").using("gin", t.tsv),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    botId: uuid("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").notNull(),
    channel: text("channel").$type<"widget" | "playground" | "api">().notNull(),
    pageOrigin: text("page_origin"),
    messageCount: integer("message_count").notNull().default(0),
    createdAt: createdAt(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversations_bot_idx").on(t.botId, t.createdAt)],
);

export type Citation = { n: number; title: string; url: string | null; page: number | null; heading: string };

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    botId: uuid("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull(),
    citations: jsonb("citations").$type<Citation[]>().notNull().default([]),
    /** Assistant messages only: false when the bot declined (low confidence, NO_ANSWER, or provider failure). */
    answered: boolean("answered"),
    /** Why an assistant message was not answered: low_confidence | no_answer | error | not_indexed. */
    outcome: text("outcome"),
    confidence: real("confidence"),
    provider: text("provider"),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    createdAt: createdAt(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt), index("messages_bot_idx").on(t.botId, t.createdAt)],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    botId: uuid("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    name: text("name"),
    question: text("question").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("leads_bot_idx").on(t.botId, t.createdAt)],
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    botId: uuid("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"chat" | "embedding">().notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    /** True when the provider did not report usage and tokens were estimated from text length. */
    estimated: boolean("estimated").notNull().default(false),
    costUsd: real("cost_usd").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("usage_bot_idx").on(t.botId, t.createdAt)],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);


export type User = typeof users.$inferSelect;
export type Bot = typeof bots.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Lead = typeof leads.$inferSelect;
