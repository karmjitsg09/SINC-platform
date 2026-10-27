import { Test, TestingModule } from '@nestjs/testing';
import { AccessPolicyService, PostWithPrivacy, ProfileWithPrivacy } from './access-policy.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AccessPolicyService (Intended Access Rules & POST_VISIBILITY = public-toggle)', () => {
  let service: AccessPolicyService;
  let prismaMock: any;

  const userAlice = '00000000-0000-0000-0000-000000000001';
  const userBob = '00000000-0000-0000-0000-000000000002';
  const userCharlie = '00000000-0000-0000-0000-000000000003';
  const conversationId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prismaMock = {
      conversation_members: {
        findUnique: jest.fn(),
      },
      follow_requests: {
        findUnique: jest.fn(),
      },
      blocked_users: {
        findFirst: jest.fn(),
      },
      profiles: {
        findUnique: jest.fn(),
      },
      $queryRawUnsafe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessPolicyService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<AccessPolicyService>(AccessPolicyService);
  });

  describe('1. Profile Policies', () => {
    it('allows read access to profile when not blocked', async () => {
      prismaMock.blocked_users.findFirst.mockResolvedValue(null);
      expect(await service.canReadProfile(userBob, userAlice)).toBe(true);
      expect(await service.canReadProfile(null, userAlice)).toBe(true);
      expect(await service.canReadProfile(undefined, userAlice)).toBe(true);
    });

    it('denies read access to profile when blocked in either direction', async () => {
      prismaMock.blocked_users.findFirst.mockResolvedValue({ id: 'block-1' });
      expect(await service.canReadProfile(userBob, userAlice)).toBe(false);
      expect(await service.canReadProfile(userAlice, userBob)).toBe(false);
    });

    it('denies read access if profileId is missing', async () => {
      expect(await service.canReadProfile(userAlice, '')).toBe(false);
    });

    it('allows owner to insert profile, denies others', () => {
      expect(service.canInsertProfile(userAlice, userAlice)).toBe(true);
      expect(service.canInsertProfile(userAlice, userBob)).toBe(false);
      expect(service.canInsertProfile('', userAlice)).toBe(false);
    });

    it('allows owner to update profile, denies others', () => {
      expect(service.canUpdateProfile(userAlice, userAlice)).toBe(true);
      expect(service.canUpdateProfile(userAlice, userBob)).toBe(false);
      expect(service.canUpdateProfile('', userAlice)).toBe(false);
    });
  });

  describe('2. Post Policies & POST_VISIBILITY = public-toggle', () => {
    const publicPost: PostWithPrivacy = { id: 'p1', user_id: userAlice, is_private: false };
    const privatePost: PostWithPrivacy = { id: 'p2', user_id: userAlice, is_private: true };
    const publicAuthor: ProfileWithPrivacy = { id: userAlice, is_private: false };
    const privateAuthor: ProfileWithPrivacy = { id: userAlice, is_private: true };

    it('allows author to view their own post regardless of privacy', async () => {
      expect(await service.canViewPost(userAlice, publicPost, publicAuthor)).toBe(true);
      expect(await service.canViewPost(userAlice, privatePost, privateAuthor)).toBe(true);
    });

    it('allows viewers to see public posts from public authors', async () => {
      prismaMock.blocked_users.findFirst.mockResolvedValue(null);
      expect(await service.canViewPost(userBob, publicPost, publicAuthor)).toBe(true);
      expect(await service.canViewPost(null, publicPost, publicAuthor)).toBe(true);
    });

    it('denies post visibility if viewer and author have a block relationship', async () => {
      prismaMock.blocked_users.findFirst.mockResolvedValue({ id: 'block-1' });
      expect(await service.canViewPost(userBob, publicPost, publicAuthor)).toBe(false);
    });

    it('denies signed-out viewers from seeing private posts or posts by private authors', async () => {
      prismaMock.blocked_users.findFirst.mockResolvedValue(null);
      // Private post on public author
      expect(await service.canViewPost(null, privatePost, publicAuthor)).toBe(false);
      expect(await service.canViewPost(undefined, privatePost, publicAuthor)).toBe(false);
      // Public post on private author
      expect(await service.canViewPost(null, publicPost, privateAuthor)).toBe(false);
    });

    it('denies stranger from seeing private post', async () => {
      prismaMock.blocked_users.findFirst.mockResolvedValue(null);
      prismaMock.follow_requests.findUnique.mockResolvedValue(null);
      expect(await service.canViewPost(userBob, privatePost, publicAuthor)).toBe(false);
    });

    it('denies pending follower from seeing private post', async () => {
      prismaMock.blocked_users.findFirst.mockResolvedValue(null);
      prismaMock.follow_requests.findUnique.mockResolvedValue({ status: 'pending' });
      expect(await service.canViewPost(userBob, privatePost, publicAuthor)).toBe(false);
    });

    it('denies rejected follower from seeing private post', async () => {
      prismaMock.blocked_users.findFirst.mockResolvedValue(null);
      prismaMock.follow_requests.findUnique.mockResolvedValue({ status: 'rejected' });
      expect(await service.canViewPost(userBob, privatePost, publicAuthor)).toBe(false);
    });

    it('allows accepted follower to view private post', async () => {
      prismaMock.blocked_users.findFirst.mockResolvedValue(null);
      prismaMock.follow_requests.findUnique.mockResolvedValue({ status: 'accepted' });
      expect(await service.canViewPost(userBob, privatePost, publicAuthor)).toBe(true);
      expect(await service.canViewPost(userBob, publicPost, privateAuthor)).toBe(true);
    });

    it('allows author to create, update, and delete post, denies others', () => {
      expect(service.canCreatePost(userAlice, userAlice)).toBe(true);
      expect(service.canCreatePost(userAlice, userBob)).toBe(false);

      expect(service.canUpdatePost(userAlice, userAlice)).toBe(true);
      expect(service.canUpdatePost(userAlice, userBob)).toBe(false);

      expect(service.canDeletePost(userAlice, userAlice)).toBe(true);
      expect(service.canDeletePost(userAlice, userBob)).toBe(false);
    });
  });

  describe('3. Post Interactions (Likes, Comments, Saves, Shares)', () => {
    const publicPost: PostWithPrivacy = { id: 'p1', user_id: userAlice, is_private: false };

    beforeEach(() => {
      prismaMock.blocked_users.findFirst.mockResolvedValue(null);
      prismaMock.profiles.findUnique.mockResolvedValue({ is_private: false });
    });

    it('allows caller to like/unlike own action if post is visible, denies impersonation', async () => {
      expect(await service.canLikePost(userBob, userBob, publicPost)).toBe(true);
      expect(await service.canLikePost(userBob, userAlice, publicPost)).toBe(false);
      expect(service.canUnlikePost(userBob, userBob)).toBe(true);
      expect(service.canUnlikePost(userBob, userAlice)).toBe(false);
    });

    it('allows caller to comment/update/delete own comment, post author can delete any comment', async () => {
      expect(await service.canCommentOnPost(userBob, userBob, publicPost)).toBe(true);
      expect(await service.canCommentOnPost(userBob, userAlice, publicPost)).toBe(false);

      expect(service.canUpdateComment(userBob, userBob)).toBe(true);
      expect(service.canUpdateComment(userBob, userAlice)).toBe(false);

      // Comment author can delete
      expect(service.canDeleteComment(userBob, userBob, userAlice)).toBe(true);
      // Post author can delete comment on their post
      expect(service.canDeleteComment(userAlice, userBob, userAlice)).toBe(true);
      // Third party cannot delete
      expect(service.canDeleteComment(userCharlie, userBob, userAlice)).toBe(false);
    });

    it('allows user to save/unsave for themselves if post is visible', async () => {
      expect(await service.canSavePost(userBob, userBob, publicPost)).toBe(true);
      expect(await service.canSavePost(userBob, userAlice, publicPost)).toBe(false);
      expect(service.canUnsavePost(userBob, userBob)).toBe(true);
      expect(service.canUnsavePost(userBob, userAlice)).toBe(false);
    });

    it('allows sender to share post if visible and recipient is not blocked', async () => {
      expect(await service.canSharePost(userBob, userBob, userCharlie, publicPost)).toBe(true);
      // Impersonation
      expect(await service.canSharePost(userBob, userAlice, userCharlie, publicPost)).toBe(false);
      // Recipient blocked
      prismaMock.blocked_users.findFirst.mockResolvedValueOnce({ id: 'block-1' });
      expect(await service.canSharePost(userBob, userBob, userCharlie, publicPost)).toBe(false);
    });
  });

  describe('4. Follow Requests Policies (Real columns: follower_user_id, following_user_id)', () => {
    beforeEach(() => {
      prismaMock.blocked_users.findFirst.mockResolvedValue(null);
    });

    it('allows sender to create follow request and rejects self-follow and blocked follow', async () => {
      expect(await service.canSendFollowRequest(userAlice, userAlice, userBob)).toBe(true);
      expect(await service.canSendFollowRequest(userAlice, userBob, userAlice)).toBe(false);
      expect(await service.canSendFollowRequest(userAlice, userAlice, userAlice)).toBe(false);

      prismaMock.blocked_users.findFirst.mockResolvedValueOnce({ id: 'block-1' });
      expect(await service.canSendFollowRequest(userAlice, userAlice, userBob)).toBe(false);
    });

    it('allows both follower and following to view request when not blocked, denies strangers', async () => {
      const req = { follower_user_id: userAlice, following_user_id: userBob };
      expect(await service.canViewFollowRequest(userAlice, req)).toBe(true);
      expect(await service.canViewFollowRequest(userBob, req)).toBe(true);
      expect(await service.canViewFollowRequest(userCharlie, req)).toBe(false);

      prismaMock.blocked_users.findFirst.mockResolvedValueOnce({ id: 'block-1' });
      expect(await service.canViewFollowRequest(userAlice, req)).toBe(false);
    });

    it('allows both follower and following to update status, denies strangers', () => {
      const req = { follower_user_id: userAlice, following_user_id: userBob };
      expect(service.canUpdateFollowRequest(userAlice, req)).toBe(true);
      expect(service.canUpdateFollowRequest(userBob, req)).toBe(true);
      expect(service.canUpdateFollowRequest(userCharlie, req)).toBe(false);
    });
  });

  describe('5. Conversation & Messaging Policies', () => {
    it('allows authenticated users to create conversations', () => {
      expect(service.canCreateConversation(userAlice)).toBe(true);
      expect(service.canCreateConversation('')).toBe(false);
    });

    it('allows conversation members to view conversation, denies non-members', async () => {
      prismaMock.conversation_members.findUnique.mockResolvedValueOnce({
        conversation_id: conversationId,
        user_id: userAlice,
      });
      expect(await service.canViewConversation(userAlice, conversationId)).toBe(true);

      prismaMock.conversation_members.findUnique.mockResolvedValueOnce(null);
      expect(await service.canViewConversation(userCharlie, conversationId)).toBe(false);
    });

    it('allows conversation members to send messages, denies non-members and impersonators', async () => {
      prismaMock.conversation_members.findUnique.mockResolvedValueOnce({
        conversation_id: conversationId,
        user_id: userAlice,
      });
      expect(await service.canSendMessage(userAlice, conversationId, userAlice)).toBe(true);

      // Impersonating sender
      expect(await service.canSendMessage(userAlice, conversationId, userBob)).toBe(false);

      // Non-member
      prismaMock.conversation_members.findUnique.mockResolvedValueOnce(null);
      expect(await service.canSendMessage(userCharlie, conversationId, userCharlie)).toBe(false);
    });

    it('allows user to update their own message_status, denies others', () => {
      expect(service.canUpdateMessageStatus(userAlice, userAlice)).toBe(true);
      expect(service.canUpdateMessageStatus(userAlice, userBob)).toBe(false);
    });
  });

  describe('6. Notifications Policies (Real columns: recipient_id, actor_id)', () => {
    it('allows authenticated users to create notifications', () => {
      expect(service.canCreateNotification('authenticated')).toBe(true);
      expect(service.canCreateNotification('anon')).toBe(false);
    });

    it('allows recipient to read and update notification, denies others', () => {
      expect(service.canReadNotification(userAlice, userAlice)).toBe(true);
      expect(service.canReadNotification(userBob, userAlice)).toBe(false);

      expect(service.canUpdateNotification(userAlice, userAlice)).toBe(true);
      expect(service.canUpdateNotification(userBob, userAlice)).toBe(false);
    });
  });

  describe('7. Updates & Update Views Policies', () => {
    it('allows author to create and delete updates, denies others', () => {
      expect(service.canCreateUpdate(userAlice, userAlice)).toBe(true);
      expect(service.canCreateUpdate(userBob, userAlice)).toBe(false);

      expect(service.canDeleteUpdate(userAlice, userAlice)).toBe(true);
      expect(service.canDeleteUpdate(userBob, userAlice)).toBe(false);
    });

    it('allows viewing active updates for authorized followers and rejects expired updates', async () => {
      prismaMock.blocked_users.findFirst.mockResolvedValue(null);
      prismaMock.follow_requests.findUnique.mockResolvedValue({ status: 'accepted' });

      const activeUpdate = { user_id: userAlice, expires_at: new Date(Date.now() + 3600000) };
      const expiredUpdate = { user_id: userAlice, expires_at: new Date(Date.now() - 3600000) };

      expect(await service.canViewUpdate(userBob, activeUpdate)).toBe(true);
      expect(await service.canViewUpdate(userBob, expiredUpdate)).toBe(false);
    });

    it('allows viewer to record update view if update is viewable, denies impersonation', async () => {
      prismaMock.blocked_users.findFirst.mockResolvedValue(null);
      prismaMock.follow_requests.findUnique.mockResolvedValue({ status: 'accepted' });

      const activeUpdate = { user_id: userAlice, expires_at: new Date(Date.now() + 3600000) };

      expect(await service.canRecordUpdateView(userBob, userBob, activeUpdate)).toBe(true);
      expect(await service.canRecordUpdateView(userBob, userAlice, activeUpdate)).toBe(false);
    });
  });

  describe('8. Social Relationship Matrix (Follow State, Block State, Private Content)', () => {
    it('correctly maps follow states: owner, stranger, pending, accepted, rejected, removed', async () => {
      // Owner
      expect(await service.getFollowState(userAlice, userAlice)).toBe('owner');

      // Stranger (no record)
      prismaMock.follow_requests.findUnique.mockResolvedValueOnce(null);
      expect(await service.getFollowState(userAlice, userBob)).toBe('stranger');

      // Pending
      prismaMock.follow_requests.findUnique.mockResolvedValueOnce({ status: 'pending' });
      expect(await service.getFollowState(userAlice, userBob)).toBe('pending');

      // Accepted
      prismaMock.follow_requests.findUnique.mockResolvedValueOnce({ status: 'accepted' });
      expect(await service.getFollowState(userAlice, userBob)).toBe('accepted');

      // Rejected
      prismaMock.follow_requests.findUnique.mockResolvedValueOnce({ status: 'rejected' });
      expect(await service.getFollowState(userAlice, userBob)).toBe('rejected');
    });

    it('enforces bidirectional blocking: A -> B or B -> A denies access', async () => {
      // Setup blocked table findFirst
      prismaMock.blocked_users.findFirst.mockResolvedValueOnce({ id: 'block-1' });
      expect(await service.isBlocked(userAlice, userBob)).toBe(true);

      prismaMock.blocked_users.findFirst.mockResolvedValueOnce({ id: 'block-2' });
      expect(await service.isBlocked(userBob, userAlice)).toBe(true);

      prismaMock.blocked_users.findFirst.mockResolvedValueOnce(null);
      expect(await service.isBlocked(userAlice, userCharlie)).toBe(false);
    });

    it('private content access matrix: signed-out, stranger, pending, rejected, accepted, blocked, owner', async () => {
      // 1. Signed out -> false
      expect(await service.canAccessPrivateContent(null, userAlice)).toBe(false);
      expect(await service.canAccessPrivateContent(undefined, userAlice)).toBe(false);

      // 2. Owner -> true
      expect(await service.canAccessPrivateContent(userAlice, userAlice)).toBe(true);

      // 3. Blocked -> false (even if accepted)
      jest.spyOn(service, 'isBlocked').mockResolvedValueOnce(true);
      expect(await service.canAccessPrivateContent(userBob, userAlice)).toBe(false);

      // 4. Stranger -> false
      jest.spyOn(service, 'isBlocked').mockResolvedValueOnce(false);
      prismaMock.follow_requests.findUnique.mockResolvedValueOnce(null);
      expect(await service.canAccessPrivateContent(userBob, userAlice)).toBe(false);

      // 5. Pending follower -> false
      jest.spyOn(service, 'isBlocked').mockResolvedValueOnce(false);
      prismaMock.follow_requests.findUnique.mockResolvedValueOnce({ status: 'pending' });
      expect(await service.canAccessPrivateContent(userBob, userAlice)).toBe(false);

      // 6. Rejected follower -> false
      jest.spyOn(service, 'isBlocked').mockResolvedValueOnce(false);
      prismaMock.follow_requests.findUnique.mockResolvedValueOnce({ status: 'rejected' });
      expect(await service.canAccessPrivateContent(userBob, userAlice)).toBe(false);

      // 7. Accepted follower -> true
      jest.spyOn(service, 'isBlocked').mockResolvedValueOnce(false);
      prismaMock.follow_requests.findUnique.mockResolvedValueOnce({ status: 'accepted' });
      expect(await service.canAccessPrivateContent(userBob, userAlice)).toBe(true);
    });
  });
});
