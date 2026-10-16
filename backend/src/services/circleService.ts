import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { Circle, type ICircle } from "../models/Circle.js";
import { CircleMembership, type CircleRole } from "../models/CircleMembership.js";
import { CircleInvite } from "../models/CircleInvite.js";
import { User, type IUser } from "../models/User.js";
import { serializeUser } from "./userSerializer.js";
import { ApiError } from "../utils/api-error.js";
import { slugify } from "../utils/slugify.js";
import { MAX_CIRCLE_HASHTAGS, normalizeHashtag } from "../utils/hashtag.js";
import * as hashtagService from "./hashtagService.js";
import { mailer } from "./mailerService.js";
import { env } from "../config/env.js";
import { emitDomainEvent } from "../events/eventBus.js";

export function serializeCircle(
  circle: ICircle,
  viewerRole?: CircleRole | null,
  memberAvatars?: string[],
) {
  return {
    id: circle._id.toString(),
    name: circle.name,
    slug: circle.slug,
    description: circle.description,
    about: circle.about ?? null,
    rules: circle.rules,
    avatarUrl: circle.avatarUrl ?? null,
    coverImageUrl: circle.coverImageUrl ?? null,
    hashtags: circle.hashtags ?? [],
    memberCount: circle.memberCount,
    postCount: circle.postCount,
    isPrivate: Boolean(circle.isPrivate),
    viewerRole: viewerRole ?? null,
    memberAvatars: memberAvatars ?? [],
    createdAt: circle.createdAt.toISOString(),
  };
}

export async function getBySlug(
  slug: string,
  viewerId?: string,
  inviteToken?: string,
): Promise<ICircle> {
  const trimmed = slug.trim();
  const normalized = slugify(trimmed);
  const circle = await Circle.findOne({
    $or: [
      { slug: trimmed },
      { slug: normalized },
      { name: { $regex: `^${escapeRegex(trimmed)}$`, $options: "i" } },
    ],
  });
  if (!circle) throw new ApiError(404, "Circle not found");

  if (circle.isPrivate) {
    let hasAccess = false;
    if (viewerId) {
      const role = await getViewerRole(circle._id.toString(), viewerId);
      if (role) {
        hasAccess = true;
      } else {
        const user = await User.findById(viewerId).select("email");
        if (user?.email) {
          const invite = await CircleInvite.findOne({
            circleId: circle._id,
            email: user.email.toLowerCase(),
            status: "pending",
            expiresAt: { $gt: new Date() },
          });
          if (invite) hasAccess = true;
        }
      }
    }

    if (!hasAccess && inviteToken) {
      const invite = await CircleInvite.findOne({
        token: inviteToken,
        circleId: circle._id,
        status: "pending",
        expiresAt: { $gt: new Date() },
      });
      if (invite) hasAccess = true;
    }

    if (!hasAccess) {
      throw new ApiError(404, "Circle not found");
    }
  }

  return circle;
}

export async function getViewerRole(
  circleId: string,
  userId?: string,
): Promise<CircleRole | null> {
  if (!userId) return null;
  const membership = await CircleMembership.findOne({ circleId, userId });
  return membership?.role ?? null;
}

const MAX_SLUG_ATTEMPTS = 8;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number }).code === 11000;
}

export async function createCircle(
  userId: string,
  input: {
    name: string;
    description: string;
    about?: string;
    rules?: string[];
    hashtags: string[];
    avatarUrl?: string;
    coverImageUrl?: string;
    isPrivate?: boolean;
  },
): Promise<ICircle> {
  const name = input.name.trim();
  if (await Circle.exists({ name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } })) {
    throw new ApiError(409, "A circle with this name already exists");
  }
  const hashtags = await hashtagService.ensureHashtags(input.hashtags, {
    createdBy: userId,
    max: MAX_CIRCLE_HASHTAGS,
  });
  if (hashtags.length < 1) throw new ApiError(422, "hashtags: pick at least one valid hashtag");
  const baseSlug = slugify(name);

  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`;
    let circle: ICircle;
    try {
      circle = await Circle.create({
        name,
        slug,
        description: input.description,
        about: input.about,
        rules: input.rules ?? [],
        hashtags,
        avatarUrl: input.avatarUrl,
        coverImageUrl: input.coverImageUrl,
        isPrivate: Boolean(input.isPrivate),
        createdBy: userId,
        memberCount: 1,
      });
    } catch (err) {
      if (isDuplicateKey(err)) continue; // slug taken (possibly by a concurrent create)
      throw err;
    }
    try {
      await CircleMembership.create({ circleId: circle._id, userId, role: "owner" });
    } catch (err) {
      await Circle.deleteOne({ _id: circle._id }); // never leave an ownerless circle behind
      throw err;
    }
    return circle;
  }
  throw new ApiError(409, "Could not allocate a unique handle for this circle, try a different name");
}

export async function listCircles(
  query: { q?: string; hashtag?: string; limit?: number },
  viewerId?: string,
) {
  const filter: Record<string, unknown> = {};
  if (query.hashtag) {
    const name = normalizeHashtag(query.hashtag);
    if (!name) return [];
    filter.hashtags = name;
  }
  const limit = query.limit ?? 50;

  const conditions: Record<string, unknown>[] = [];

  // Visibility / Privacy filter:
  // Public circles are visible to everyone.
  // Private circles are ONLY visible if viewerId is a member or owner.
  if (viewerId) {
    const memberships = await CircleMembership.find({ userId: viewerId }).select("circleId");
    const joinedCircleIds = memberships.map((m) => m.circleId);
    conditions.push({
      $or: [
        { isPrivate: false },
        { isPrivate: { $exists: false } },
        { _id: { $in: joinedCircleIds } },
      ],
    });
  } else {
    conditions.push({
      $or: [
        { isPrivate: false },
        { isPrivate: { $exists: false } },
      ],
    });
  }

  if (query.q) {
    const trimmed = query.q.trim();
    if (trimmed) {
      const regex = new RegExp(escapeRegex(trimmed), "i");
      conditions.push({
        $or: [
          { name: regex },
          { slug: regex },
          { description: regex },
          { hashtags: regex },
        ],
      });
    }
  }

  if (conditions.length === 1) {
    Object.assign(filter, conditions[0]);
  } else if (conditions.length > 1) {
    filter.$and = conditions;
  }

  const find = Circle.find(filter).sort({ memberCount: -1, _id: 1 });
  const circles = await find.limit(limit);

  const roles = new Map<string, CircleRole>();
  if (viewerId && circles.length > 0) {
    const memberships = await CircleMembership.find({
      userId: viewerId,
      circleId: { $in: circles.map((c) => c._id) },
    }).select("circleId role");
    for (const m of memberships) roles.set(m.circleId.toString(), m.role);
  }

  const circleIds = circles.map((c) => c._id);
  const memberships = await CircleMembership.find({
    circleId: { $in: circleIds },
  })
    .sort({ createdAt: 1 })
    .populate({ path: "userId", select: "avatarUrl displayName" });

  const avatarsByCircle = new Map<string, string[]>();
  for (const m of memberships) {
    const cId = m.circleId.toString();
    const list = avatarsByCircle.get(cId) ?? [];
    if (list.length < 5) {
      const u = m.userId as unknown as { avatarUrl?: string };
      if (u?.avatarUrl) {
        list.push(u.avatarUrl);
      }
      avatarsByCircle.set(cId, list);
    }
  }

  return circles.map((c) =>
    serializeCircle(
      c,
      roles.get(c._id.toString()) ?? null,
      avatarsByCircle.get(c._id.toString()) ?? [],
    ),
  );
}

const ROLE_RANK: Record<CircleRole, number> = { owner: 0, moderator: 1, member: 2 };
const MEMBER_LIMIT = 100;

export async function listMembers(circleId: Types.ObjectId) {
  const memberships = await CircleMembership.find({ circleId })
    .sort({ createdAt: 1 })
    .limit(MEMBER_LIMIT * 2)
    .populate({
      path: "userId",
      select: "handle displayName avatarUrl bio reputation followerCount followingCount postCount createdAt",
    });
  return memberships
    .filter((m) => m.userId)
    .sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role])
    .slice(0, MEMBER_LIMIT)
    .map((m) => ({ role: m.role, user: serializeUser(m.userId as unknown as IUser) }));
}

export async function joinCircle(
  circleId: string,
  userId: string,
  inviteToken?: string,
): Promise<void> {
  const circle = await Circle.findById(circleId);
  if (!circle) throw new ApiError(404, "Circle not found");

  if (circle.isPrivate) {
    let invite = null;
    if (inviteToken) {
      invite = await CircleInvite.findOne({
        token: inviteToken,
        circleId: circle._id,
        status: "pending",
        expiresAt: { $gt: new Date() },
      });
    }
    if (!invite) {
      const user = await User.findById(userId).select("email");
      if (user?.email) {
        invite = await CircleInvite.findOne({
          circleId: circle._id,
          email: user.email.toLowerCase(),
          status: "pending",
          expiresAt: { $gt: new Date() },
        });
      }
    }

    if (!invite) {
      throw new ApiError(403, "This circle is private and can only be joined via an invitation link");
    }

    // Mark the invite as accepted
    invite.status = "accepted";
    invite.acceptedAt = new Date();
    invite.acceptedBy = new Types.ObjectId(userId);
    await invite.save();
  }

  try {
    await CircleMembership.create({ circleId, userId, role: "member" });
  } catch (err: unknown) {
    if (isDuplicateKey(err)) return; // already a member
    throw err;
  }
  await Circle.updateOne({ _id: circleId }, { $inc: { memberCount: 1 } });
}

export async function leaveCircle(circleId: string, userId: string): Promise<void> {
  // Delete atomically so two concurrent leaves can't both decrement the count.
  const removed = await CircleMembership.findOneAndDelete({
    circleId,
    userId,
  });
  if (removed) {
    await Circle.updateOne({ _id: circleId, memberCount: { $gt: 0 } }, { $inc: { memberCount: -1 } });

    // Revoke any invites for this user for this circle so they cannot preview or re-enter a private circle after leaving
    const user = await User.findById(userId).select("email");
    const emailFilter = user?.email ? [{ email: user.email.toLowerCase() }] : [];
    await CircleInvite.updateMany(
      {
        circleId: new Types.ObjectId(circleId),
        $or: [
          ...emailFilter,
          { acceptedBy: new Types.ObjectId(userId) },
        ],
      },
      { $set: { status: "revoked" } },
    );
  }
}

const CIRCLE_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export async function createCircleInvite(
  slug: string,
  inviterUserId: string,
  email: string,
): Promise<{ link: string; token: string; channel: "notification" | "email"; recipientName?: string }> {
  const trimmed = slug.trim();
  const normalized = slugify(trimmed);
  const circle = await Circle.findOne({
    $or: [
      { slug: trimmed },
      { slug: normalized },
      { name: { $regex: `^${escapeRegex(trimmed)}$`, $options: "i" } },
    ],
  });
  if (!circle) throw new ApiError(404, "Circle not found");

  const inviterRole = await getViewerRole(circle._id.toString(), inviterUserId);
  if (inviterRole !== "owner" && inviterRole !== "moderator") {
    throw new ApiError(403, "Only circle owners and moderators can invite members");
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check if this email is already registered in Centoire
  const registeredUser = await User.findOne({ email: normalizedEmail }).select("_id displayName handle");

  if (registeredUser) {
    if (registeredUser._id.toString() === inviterUserId) {
      throw new ApiError(400, "You cannot invite yourself to your own circle");
    }

    const alreadyMember = await CircleMembership.exists({
      circleId: circle._id,
      userId: registeredUser._id,
    });
    if (alreadyMember) {
      throw new ApiError(400, "This user is already a member of this circle");
    }
  }

  const token = randomBytes(32).toString("hex");

  await CircleInvite.create({
    circleId: circle._id,
    invitedBy: inviterUserId,
    email: normalizedEmail,
    token,
    status: "pending",
    expiresAt: new Date(Date.now() + CIRCLE_INVITE_TTL_MS),
  });

  const inviterUser = await User.findById(inviterUserId).select("displayName handle");
  const inviterName = inviterUser?.displayName || inviterUser?.handle || "A circle moderator";

  const link = `${env.CLIENT_ORIGIN}/invite/${token}`;

  let channel: "notification" | "email" = "email";
  let recipientName: string | undefined;

  if (registeredUser) {
    channel = "notification";
    recipientName = registeredUser.displayName || registeredUser.handle;
    // Dispatch in-app bell notification
    emitDomainEvent("circle.invite", {
      actorId: inviterUserId,
      recipientId: registeredUser._id.toString(),
      circleId: circle._id.toString(),
      inviteToken: token,
    });
  } else {
    // Unregistered new user -> send branded invitation email
    await mailer.sendCircleInvite(normalizedEmail, link, circle.name, inviterName);
  }

  return { link, token, channel, recipientName };
}

export async function previewCircleInvite(token: string) {
  const invite = await CircleInvite.findOne({ token })
    .populate("circleId")
    .populate("invitedBy", "displayName handle");
  if (!invite) throw new ApiError(404, "Invitation not found");

  const notExpired = invite.expiresAt > new Date();
  const valid = notExpired && invite.status === "pending";
  const circle = invite.circleId as unknown as ICircle;
  const inviter = invite.invitedBy as unknown as { displayName?: string; handle?: string };

  return {
    valid,
    status: invite.status,
    email: invite.email,
    circleName: circle?.name || "Private Circle",
    circleSlug: circle?.slug || "",
    avatarUrl: circle?.avatarUrl || null,
    coverImageUrl: circle?.coverImageUrl || null,
    description: circle?.description || "",
    inviterName: inviter?.displayName || inviter?.handle || "A member",
  };
}

export async function acceptCircleInvite(token: string, userId: string): Promise<{ slug: string }> {
  const invite = await CircleInvite.findOne({ token });
  if (!invite) throw new ApiError(404, "Invitation not found");

  const circle = await Circle.findById(invite.circleId);
  if (!circle) throw new ApiError(404, "Circle no longer exists");

  const user = await User.findById(userId).select("email");
  const isIntendedRecipient = Boolean(
    user && invite.email && user.email.toLowerCase() === invite.email.toLowerCase(),
  );

  // If user is already a member of this circle (e.g. inviter or existing member):
  const existingMembership = await CircleMembership.findOne({ circleId: circle._id, userId });
  if (existingMembership) {
    // Only mark accepted if this is the actual recipient of the invite
    if (isIntendedRecipient && invite.status === "pending") {
      invite.status = "accepted";
      invite.acceptedAt = new Date();
      invite.acceptedBy = new Types.ObjectId(userId);
      await invite.save();
    }
    return { slug: circle.slug };
  }

  // If user is NOT a member:
  if (invite.status !== "pending") {
    throw new ApiError(409, "Invitation has already been used or revoked");
  }
  if (invite.expiresAt < new Date()) {
    throw new ApiError(410, "Invitation has expired");
  }

  // Add user to CircleMembership
  try {
    await CircleMembership.create({
      circleId: circle._id,
      userId,
      role: "member",
    });
    await Circle.updateOne({ _id: circle._id }, { $inc: { memberCount: 1 } });
  } catch (err: unknown) {
    if (!isDuplicateKey(err)) throw err;
    // already a member, continue
  }

  invite.status = "accepted";
  invite.acceptedAt = new Date();
  invite.acceptedBy = new Types.ObjectId(userId);
  await invite.save();

  return { slug: circle.slug };
}
