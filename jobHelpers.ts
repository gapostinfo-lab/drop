import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Valid status transitions for courier flow
export const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["requested", "cancelled"],
  requested: ["matched", "cancelled"],
  matched: ["en_route", "cancelled"],
  en_route: ["arrived", "cancelled"],
  arrived: ["picked_up", "cancelled"],
  picked_up: ["dropped_off"],
  dropped_off: ["completed"],
  completed: [],
  cancelled: [],
};

/**
 * Check if a status transition is valid
 */
export function isValidTransition(currentStatus: string, newStatus: string): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Get a user-friendly error message for invalid transitions
 */
export function getTransitionError(currentStatus: string, newStatus: string): string {
  const validNext = VALID_TRANSITIONS[currentStatus] || [];
  if (validNext.length === 0) {
    return `Job is already ${currentStatus} and cannot be updated`;
  }
  return `Cannot change from "${currentStatus}" to "${newStatus}". Valid next states: ${validNext.join(", ")}`;
}

/**
 * Log a job event for audit trail
 */
export async function logJobEvent(
  ctx: MutationCtx,
  params: {
    jobId: Id<"jobs">;
    courierId?: Id<"users">;
    customerId?: Id<"users">;
    eventType: string;
    previousStatus?: string;
    newStatus?: string;
    latitude?: number;
    longitude?: number;
    metadata?: Record<string, unknown>;
    errorMessage?: string;
  }
) {
  await ctx.db.insert("jobEvents", {
    ...params,
    timestamp: Date.now(),
  });
}

/**
 * Custom error class with additional context for debugging
 */
export class CourierFlowError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "CourierFlowError";
  }
}
