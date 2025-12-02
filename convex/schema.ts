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
  })
    .index("by_room", ["roomId"])
    .index("by_session", ["sessionId"]),
})
