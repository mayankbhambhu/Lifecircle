/** Hand-off between the login screen and onboarding (kept in memory only, never persisted). */
let pending = null
export const setPendingOnboarding = p => { pending = p }
export const getPendingOnboarding = () => pending
