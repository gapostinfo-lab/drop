import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
  session: {
    // How long can a session last without reauthenticating (30 days)
    totalDurationMs: 1000 * 60 * 60 * 24 * 30,
    // How long can a session last without activity (7 days)
    inactiveDurationMs: 1000 * 60 * 60 * 24 * 7,
  },
  jwt: {
    // How long is the JWT valid (24 hours instead of default 1 hour)
    // This reduces how often refresh is needed
    durationMs: 1000 * 60 * 60 * 24,
  },
});
