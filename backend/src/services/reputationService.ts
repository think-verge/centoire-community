import { ReputationEvent, type ReputationEventType } from "../models/ReputationEvent.js";
import { User } from "../models/User.js";

const AMOUNTS: Record<ReputationEventType, number> = {
  post_published: 2,
  post_upvoted: 10,
  comment_upvoted: 5,
  vote_removed: 0, // actual amount passed explicitly when reversing
};

interface AwardInput {
  type: ReputationEventType;
  refType: "post" | "comment";
  refId: string;
  actorId?: string;
  /** Override amount (used for reversals). */
  amount?: number;
}

// NOTE: this is also the future emit point for notifications (P1).
export async function award(userId: string, input: AwardInput): Promise<void> {
  const amount = input.amount ?? AMOUNTS[input.type];
  if (amount === 0 && input.amount === undefined) return;
  await ReputationEvent.create({
    userId,
    type: input.type,
    amount,
    actorId: input.actorId,
    refType: input.refType,
    refId: input.refId,
  });
  await User.updateOne({ _id: userId }, { $inc: { reputation: amount } });
}
