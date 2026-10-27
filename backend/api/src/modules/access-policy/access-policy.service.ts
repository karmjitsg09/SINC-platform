import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type FollowState = 'owner' | 'stranger' | 'pending' | 'accepted' | 'rejected' | 'removed';

export interface PostWithPrivacy {
  id?: string;
  user_id: string;
  is_private?: boolean;
}

export interface ProfileWithPrivacy {
  id: string;
  is_private?: boolean;
}

@Injectable()
export class AccessPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  // --------------------------------------------------------------------------
  // 1. Profile Access Policies (Intended: Public unless blocked)
  // --------------------------------------------------------------------------
  async canReadProfile(callerId: string | null | undefined, profileId: string): Promise<boolean> {
    if (!profileId) return false;
    if (callerId && (await this.isBlocked(callerId, profileId))) {
      return false;
    }
    return true;
  }

  canInsertProfile(callerId: string, targetProfileId: string): boolean {
    return Boolean(callerId) && callerId === targetProfileId;
  }

  canUpdateProfile(callerId: string, targetProfileId: string): boolean {
    return Boolean(callerId) && callerId === targetProfileId;
  }

  // --------------------------------------------------------------------------
  // 2. Post Access Policies (Intended: POST_VISIBILITY = public-toggle)
  // --------------------------------------------------------------------------
  async canViewPost(
    callerId: string | null | undefined,
    post: PostWithPrivacy,
    authorProfile?: ProfileWithPrivacy,
  ): Promise<boolean> {
    const authorId = post.user_id;

    // 1. Author can always view own post
    if (callerId && callerId === authorId) {
      return true;
    }

    // 2. If blocked in either direction, cannot view
    if (callerId && (await this.isBlocked(callerId, authorId))) {
      return false;
    }

    // 3. Check author profile privacy if not passed in
    let isAuthorPrivate = authorProfile?.is_private;
    if (isAuthorPrivate === undefined) {
      const profile = await this.prisma.profiles.findUnique({
        where: { id: authorId },
        select: { is_private: true },
      });
      isAuthorPrivate = Boolean(profile?.is_private);
    }

    const isPostPrivate = Boolean(post.is_private) || isAuthorPrivate;

    // 4. If public post from public author: visible to authenticated/authorized viewers
    if (!isPostPrivate) {
      return true;
    }

    // 5. If private: signed-out users cannot view
    if (!callerId) {
      return false;
    }

    // 6. If private: requires accepted follower status
    const followState = await this.getFollowState(callerId, authorId);
    return followState === 'accepted';
  }

  canCreatePost(callerId: string, postAuthorId: string): boolean {
    return Boolean(callerId) && callerId === postAuthorId;
  }

  canUpdatePost(callerId: string, postAuthorId: string): boolean {
    return Boolean(callerId) && callerId === postAuthorId;
  }

  canDeletePost(callerId: string, postAuthorId: string): boolean {
    return Boolean(callerId) && callerId === postAuthorId;
  }

  // --------------------------------------------------------------------------
  // 3. Post Interactions (Likes, Comments, Saves, Shares)
  // --------------------------------------------------------------------------
  async canLikePost(
    callerId: string,
    interactionUserId: string,
    post: PostWithPrivacy,
  ): Promise<boolean> {
    if (!callerId || callerId !== interactionUserId) return false;
    return this.canViewPost(callerId, post);
  }

  canUnlikePost(callerId: string, interactionUserId: string): boolean {
    return Boolean(callerId) && callerId === interactionUserId;
  }

  async canCommentOnPost(
    callerId: string,
    interactionUserId: string,
    post: PostWithPrivacy,
  ): Promise<boolean> {
    if (!callerId || callerId !== interactionUserId) return false;
    return this.canViewPost(callerId, post);
  }

  canUpdateComment(callerId: string, commentAuthorId: string): boolean {
    return Boolean(callerId) && callerId === commentAuthorId;
  }

  canDeleteComment(callerId: string, commentAuthorId: string, postAuthorId?: string): boolean {
    return Boolean(callerId) && (callerId === commentAuthorId || callerId === postAuthorId);
  }

  async canSavePost(
    callerId: string,
    interactionUserId: string,
    post: PostWithPrivacy,
  ): Promise<boolean> {
    if (!callerId || callerId !== interactionUserId) return false;
    return this.canViewPost(callerId, post);
  }

  canUnsavePost(callerId: string, interactionUserId: string): boolean {
    return Boolean(callerId) && callerId === interactionUserId;
  }

  async canSharePost(
    callerId: string,
    senderId: string,
    recipientId: string,
    post: PostWithPrivacy,
  ): Promise<boolean> {
    if (!callerId || callerId !== senderId) return false;
    if (await this.isBlocked(callerId, recipientId)) return false;
    return this.canViewPost(callerId, post);
  }

  // --------------------------------------------------------------------------
  // 4. Follow Requests Policies (Real columns: follower_user_id, following_user_id)
  // --------------------------------------------------------------------------
  async canSendFollowRequest(
    callerId: string,
    followerUserId: string,
    followingUserId: string,
  ): Promise<boolean> {
    if (!callerId || callerId !== followerUserId) return false;
    if (followerUserId === followingUserId) return false; // Anti self-follow
    if (await this.isBlocked(followerUserId, followingUserId)) return false;
    return true;
  }

  async canViewFollowRequest(
    callerId: string,
    request: { follower_user_id: string; following_user_id: string },
  ): Promise<boolean> {
    if (callerId !== request.follower_user_id && callerId !== request.following_user_id) {
      return false;
    }
    if (await this.isBlocked(request.follower_user_id, request.following_user_id)) {
      return false;
    }
    return true;
  }

  canUpdateFollowRequest(
    callerId: string,
    request: { follower_user_id: string; following_user_id: string },
  ): boolean {
    return callerId === request.follower_user_id || callerId === request.following_user_id;
  }

  // --------------------------------------------------------------------------
  // 5. Conversation & Messaging Policies (Member-Only)
  // --------------------------------------------------------------------------
  canCreateConversation(callerId: string): boolean {
    return Boolean(callerId);
  }

  async isConversationMember(callerId: string, conversationId: string): Promise<boolean> {
    if (!callerId || !conversationId) return false;

    const member = await this.prisma.conversation_members.findUnique({
      where: {
        conversation_id_user_id: {
          conversation_id: conversationId,
          user_id: callerId,
        },
      },
    });

    return member !== null;
  }

  async canViewConversation(callerId: string, conversationId: string): Promise<boolean> {
    return this.isConversationMember(callerId, conversationId);
  }

  async canSendMessage(
    callerId: string,
    conversationId: string,
    senderId: string,
  ): Promise<boolean> {
    if (callerId !== senderId) return false;
    return this.isConversationMember(callerId, conversationId);
  }

  async canViewMessage(
    callerId: string,
    conversationId: string,
    senderId?: string,
  ): Promise<boolean> {
    if (!(await this.isConversationMember(callerId, conversationId))) return false;
    if (senderId && (await this.isBlocked(callerId, senderId))) return false;
    return true;
  }

  canUpdateMessageStatus(callerId: string, statusUserId: string): boolean {
    return Boolean(callerId) && callerId === statusUserId;
  }

  // --------------------------------------------------------------------------
  // 6. Notification Policies (Strictly Recipient-Only)
  // --------------------------------------------------------------------------
  canCreateNotification(callerRole: string): boolean {
    return callerRole === 'authenticated';
  }

  canReadNotification(callerId: string, recipientId: string): boolean {
    return Boolean(callerId) && callerId === recipientId;
  }

  canUpdateNotification(callerId: string, recipientId: string): boolean {
    return Boolean(callerId) && callerId === recipientId;
  }

  // --------------------------------------------------------------------------
  // 7. Updates & Stories Policies
  // --------------------------------------------------------------------------
  canCreateUpdate(callerId: string, authorId: string): boolean {
    return Boolean(callerId) && callerId === authorId;
  }

  async canViewUpdate(
    callerId: string | null | undefined,
    update: { user_id: string; expires_at: Date },
  ): Promise<boolean> {
    if (new Date(update.expires_at) <= new Date()) {
      return false; // Expired
    }
    return this.canAccessPrivateContent(callerId, update.user_id);
  }

  canDeleteUpdate(callerId: string, authorId: string): boolean {
    return Boolean(callerId) && callerId === authorId;
  }

  async canRecordUpdateView(
    callerId: string,
    viewerId: string,
    update: { user_id: string; expires_at: Date },
  ): Promise<boolean> {
    if (callerId !== viewerId) return false;
    return this.canViewUpdate(callerId, update);
  }

  // --------------------------------------------------------------------------
  // 8. Social Relationship Matrix (Follow State, Block State, Private Content)
  // --------------------------------------------------------------------------
  async getFollowState(followerId: string, targetId: string): Promise<FollowState> {
    if (followerId === targetId) {
      return 'owner';
    }

    const request = await this.prisma.follow_requests.findUnique({
      where: {
        follower_user_id_following_user_id: {
          follower_user_id: followerId,
          following_user_id: targetId,
        },
      },
    });

    if (!request) {
      return 'stranger';
    }

    switch (request.status) {
      case 'accepted':
        return 'accepted';
      case 'pending':
        return 'pending';
      case 'rejected':
        return 'rejected';
      default:
        return 'stranger';
    }
  }

  async isBlocked(userA: string, userB: string): Promise<boolean> {
    if (!userA || !userB || userA === userB) return false;

    const block = await this.prisma.blocked_users.findFirst({
      where: {
        OR: [
          { blocker_user_id: userA, blocked_user_id: userB },
          { blocker_user_id: userB, blocked_user_id: userA },
        ],
      },
    });

    return block !== null;
  }

  async canAccessPrivateContent(
    callerId: string | null | undefined,
    ownerId: string,
  ): Promise<boolean> {
    if (!callerId) {
      return false; // Signed out
    }

    if (callerId === ownerId) {
      return true; // Owner
    }

    if (await this.isBlocked(callerId, ownerId)) {
      return false; // Blocked in either direction
    }

    const followState = await this.getFollowState(callerId, ownerId);
    return followState === 'accepted';
  }
}
