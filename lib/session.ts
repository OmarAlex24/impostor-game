export function getSessionId(): string {
  if (typeof window === "undefined") return ""

  let sessionId = localStorage.getItem("impostor-session-id")
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem("impostor-session-id", sessionId)
  }
  return sessionId
}

export function getPlayerName(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("impostor-player-name")
}

export function setPlayerName(name: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem("impostor-player-name", name)
}
