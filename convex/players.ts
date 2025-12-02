import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getByRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect()
  },
})

export const getBySession = query({
  args: { sessionId: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .filter((q) => q.eq(q.field("sessionId"), args.sessionId))
      .first()
  },
})

export const toggleReady = mutation({
  args: {
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId)
    if (!player) throw new Error("Jugador no encontrado")

    await ctx.db.patch(args.playerId, {
      isReady: !player.isReady,
    })
  },
})

export const vote = mutation({
  args: {
    voterId: v.id("players"),
    targetSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const voter = await ctx.db.get(args.voterId)
    if (!voter) throw new Error("Jugador no encontrado")

    await ctx.db.patch(args.voterId, {
      votedFor: args.targetSessionId,
    })
  },
})

export const leave = mutation({
  args: {
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId)
    if (!player) return

    // Si es host, transferir a otro jugador
    if (player.isHost) {
      const otherPlayers = await ctx.db
        .query("players")
        .withIndex("by_room", (q) => q.eq("roomId", player.roomId))
        .filter((q) => q.neq(q.field("_id"), args.playerId))
        .collect()

      if (otherPlayers.length > 0) {
        // Ordenar por tiempo de unión y asignar host al primero
        otherPlayers.sort((a, b) => a.joinedAt - b.joinedAt)
        await ctx.db.patch(otherPlayers[0]._id, { isHost: true })

        // Actualizar hostId en la sala
        const room = await ctx.db.get(player.roomId)
        if (room) {
          await ctx.db.patch(player.roomId, { hostId: otherPlayers[0].sessionId })
        }
      } else {
        // Si no hay más jugadores, eliminar la sala
        await ctx.db.delete(player.roomId)
      }
    }

    await ctx.db.delete(args.playerId)
  },
})
