import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    hostId: v.string(),
    status: v.union(v.literal("waiting"), v.literal("playing"), v.literal("voting"), v.literal("results")),
    category: v.optional(v.string()),
    currentWord: v.optional(v.string()),
    impostorId: v.optional(v.string()),
    discussionEndTime: v.optional(v.number()),
    votingEndTime: v.optional(v.number()),
    // Inactive room cleanup
    lastActivityAt: v.number(),
    // Turn system
    turnOrder: v.optional(v.array(v.string())),
    currentTurnIndex: v.optional(v.number()),
    // Word history
    usedWords: v.optional(v.array(v.string())),
    // Round system (2 rounds per voting)
    roundNumber: v.optional(v.number()),
    totalRoundsPerVoting: v.optional(v.number()),
    // Turn cooldown (30s auto-pass)
    turnStartTime: v.optional(v.number()),
    turnDurationSeconds: v.optional(v.number()),
    // Call to vote
    callToVoteBy: v.optional(v.array(v.string())),
  }).index("by_code", ["code"]),

  players: defineTable({
    roomId: v.id("rooms"),
    sessionId: v.string(),
    name: v.string(),
    isHost: v.boolean(),
    isReady: v.boolean(),
    votedFor: v.optional(v.string()),
    isEliminated: v.boolean(),
    joinedAt: v.number(),
    // Points & ranking system
    points: v.optional(v.number()),
    correctVotes: v.optional(v.number()),
    timesAsImpostor: v.optional(v.number()),
    impostorWins: v.optional(v.number()),
    survivedRounds: v.optional(v.number()),
  })
    .index("by_room", ["roomId"])
    .index("by_session", ["sessionId"]),

  // Spectator chat messages
  messages: defineTable({
    roomId: v.id("rooms"),
    senderSessionId: v.string(),
    senderName: v.string(),
    content: v.string(),
    timestamp: v.number(),
    isSpectatorChat: v.boolean(),
  }).index("by_room", ["roomId"]),
})
