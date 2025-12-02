import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

// Send a spectator chat message
export const sendMessage = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.content.trim()) {
      throw new Error("El mensaje no puede estar vacío")
    }

    // Get the player
    const player = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .filter((q) => q.eq(q.field("sessionId"), args.sessionId))
      .first()

    if (!player) {
      throw new Error("Jugador no encontrado")
    }

    // Only eliminated players can send spectator messages
    if (!player.isEliminated) {
      throw new Error("Solo los espectadores pueden usar el chat")
    }

    // Create the message
    await ctx.db.insert("messages", {
      roomId: args.roomId,
      senderSessionId: args.sessionId,
      senderName: player.name,
      content: args.content.trim().substring(0, 500), // Limit message length
      timestamp: Date.now(),
      isSpectatorChat: true,
    })
  },
})

// Get all messages for a room
export const getByRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect()

    // Sort by timestamp
    return messages.sort((a, b) => a.timestamp - b.timestamp)
  },
})

// Get spectator messages only
export const getSpectatorMessages = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .filter((q) => q.eq(q.field("isSpectatorChat"), true))
      .collect()

    return messages.sort((a, b) => a.timestamp - b.timestamp)
  },
})
