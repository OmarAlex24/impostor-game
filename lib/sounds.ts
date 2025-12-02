// Sound utilities for the game

// Play turn notification sound (only for the current player)
export const playTurnSound = () => {
  try {
    const audio = new Audio('/sounds/ding.mp3')
    audio.volume = 0.5
    audio.play().catch(() => {
      // Ignore autoplay errors - browser may block autoplay
    })
  } catch {
    // Ignore errors if Audio is not available
  }
}

// Play a success sound
export const playSuccessSound = () => {
  try {
    const audio = new Audio('/sounds/success.mp3')
    audio.volume = 0.4
    audio.play().catch(() => {})
  } catch {}
}

// Play an error/elimination sound
export const playEliminationSound = () => {
  try {
    const audio = new Audio('/sounds/elimination.mp3')
    audio.volume = 0.4
    audio.play().catch(() => {})
  } catch {}
}
