# SINC Access Rules: Current Production vs. Intended Target

**Date:** 2026-10-25  
**Model:** `POST_VISIBILITY = public-toggle` (Default public profile/posts, followers-only when toggled private)  
**Security Standard:** Bidirectional blocking, member-only conversations, owner-only private details, server-only push tables  

---

## Access Rules Matrix

| Table | Action | Current Production Policy | Intended Target Policy | Reason & Security Benefit |
| :--- | :--- | :--- | :--- | :--- |
| **`profiles`** | SELECT | `USING (true)` (Anyone can view all profiles) | `USING (NOT is_blocked(auth.uid(), id))` | **Bidirectional block enforcement.** If User A blocks User B, neither can view the other's profile. |
| | INSERT | `WITH CHECK (auth.uid() = id)` | `WITH CHECK (auth.uid() = id)` | Owner-only profile creation. |
| | UPDATE | `USING (auth.uid() = id)` | `USING (auth.uid() = id)` | Owner-only profile modifications. |
| **`posts`** | SELECT | `USING (true)` (Any authenticated user can read all posts) | `USING (can_view_post(auth.uid(), id))` | **POST_VISIBILITY enforcement.** If post or author profile is private, only accepted followers and author can view. Blocked users in either direction are excluded. |
| | INSERT | `WITH CHECK (auth.uid() = user_id)` | `WITH CHECK (auth.uid() = user_id)` | Author-only post creation. |
| | UPDATE | `USING (auth.uid() = user_id)` | `USING (auth.uid() = user_id)` | Author-only post updates. |
| | DELETE | `USING (auth.uid() = user_id)` | `USING (auth.uid() = user_id)` | Author-only post deletion. |
| **`post_media`** | SELECT | *Table did not exist* | `USING (can_view_post(auth.uid(), post_id))` | Matches parent post visibility and block checks. |
| | INSERT | *Table did not exist* | `WITH CHECK (post author only)` | Media attachments can only be added to caller's own post. |
| | DELETE | *Table did not exist* | `USING (post author only)` | Post author can delete attachments. |
| **`post_comments`** | SELECT | `USING (true)` (Any authenticated user can read all comments) | `USING (can_view_post(auth.uid(), post_id) AND NOT is_blocked(auth.uid(), user_id))` | Comments on private posts are hidden from non-followers. Comments by/from blocked users are hidden. |
| | INSERT | `WITH CHECK (auth.uid() = user_id)` | `WITH CHECK (auth.uid() = user_id AND can_view_post(auth.uid(), post_id))` | Caller can only comment if they have authorization to view the post. |
| | DELETE | `USING (auth.uid() = user_id)` | `USING (auth.uid() = user_id OR post author)` | Comment author or post author can moderate comments. |
| **`post_likes`** | SELECT | `USING (true)` | `USING (can_view_post(auth.uid(), post_id) AND NOT is_blocked(auth.uid(), user_id))` | Likes on private posts are hidden from non-followers; blocked users hidden. |
| | INSERT | `WITH CHECK (auth.uid() = user_id)` | `WITH CHECK (auth.uid() = user_id AND can_view_post(auth.uid(), post_id))` | Can only like posts the user is authorized to see. |
| | DELETE | `USING (auth.uid() = user_id)` | `USING (auth.uid() = user_id)` | User can unlike own like. |
| **`post_saves`** | SELECT | `USING (true)` (Over-broad: anyone could see what others saved) | `USING (auth.uid() = user_id)` | **Strict privacy.** Saved items are strictly private bookmarks visible only to the saver. |
| | INSERT | `WITH CHECK (auth.uid() = user_id)` | `WITH CHECK (auth.uid() = user_id AND can_view_post(auth.uid(), post_id))` | Can only save visible posts. |
| | DELETE | `USING (auth.uid() = user_id)` | `USING (auth.uid() = user_id)` | User can remove own bookmark. |
| **`post_shares`** | SELECT | `USING (true)` | `USING (auth.uid() = sender_id OR auth.uid() = recipient_id)` | Shares are direct social interactions visible only to the sender and recipient. |
| | INSERT | `WITH CHECK (auth.uid() = sender_id)` | `WITH CHECK (auth.uid() = sender_id AND NOT is_blocked(auth.uid(), recipient_id))` | Cannot share posts to users who have blocked caller. |
| **`updates`** | SELECT | `USING (expires_at > now())` | `USING (expires_at > now() AND can_view_user_content(auth.uid(), user_id))` | **Stories Privacy.** Stories of private profiles are visible only to accepted followers. Blocks hide stories in both directions. |
| | INSERT | `WITH CHECK (auth.uid() = user_id)` | `WITH CHECK (auth.uid() = user_id)` | Author only. |
| | DELETE | `USING (auth.uid() = user_id)` | `USING (auth.uid() = user_id)` | Author only. |
| **`update_views`** | SELECT | *Over-broad* | `USING (auth.uid() = viewer_id OR update author)` | Only viewer and author can view story view metrics. |
| | INSERT | `WITH CHECK (auth.uid() = viewer_id)` | `WITH CHECK (auth.uid() = viewer_id AND can_view_user_content(auth.uid(), user_id))` | Can only record view if story is authorized to be seen. |
| **`blocked_users`** | SELECT | *Table did not exist* | `USING (auth.uid() = blocker_user_id)` | Blocker can view their blocklist. Target cannot view who blocked them. |
| | INSERT | *Table did not exist* | `WITH CHECK (auth.uid() = blocker_user_id AND blocker <> blocked)` | User can block another user. Self-blocking is rejected. |
| | DELETE | *Table did not exist* | `USING (auth.uid() = blocker_user_id)` | User can unblock a user they blocked. |
| **`user_private_details`**| ALL | *Table did not exist* | `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` | **Owner-Only Isolation.** Email, phone, and location settings strictly inaccessible to any other user. |
| **`profile_*` (sections)**| SELECT | *Tables did not exist* | `USING (can_view_user_content(auth.uid(), user_id))` | Profile sections follow profile privacy and block status. |
| | ALL (mutations)| *Tables did not exist* | `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` | Profile sections modifiable only by the profile owner. |
| **`follow_requests`** | SELECT | `USING (follower OR following)` | `USING ((follower OR following) AND NOT is_blocked)` | Follow requests hidden if either user blocks the other. |
| | INSERT | `WITH CHECK (auth.uid() = follower)` | `WITH CHECK (auth.uid() = follower AND NOT is_blocked AND follower <> following)` | Cannot send follow request if blocked or to self. |
| | UPDATE | `USING (follower OR following)` | `USING (follower OR following)` | Sender can cancel, recipient can accept/reject. |
| **`conversations`** | SELECT | `USING (is_member_of)` | `USING (is_member_of(id, auth.uid()))` | Conversations strictly member-only. |
| **`messages`** | SELECT | `USING (is_member_of)` | `USING (is_member_of(conversation_id, auth.uid()) AND (NOT is_blocked OR sender = auth.uid()))` | Messages hidden if sender is blocked. |
| | INSERT | `WITH CHECK (sender = auth.uid() AND is_member_of)` | `WITH CHECK (sender = auth.uid() AND is_member_of(conversation_id, auth.uid()))` | Member-only sending. |
| **`notifications`** | SELECT | `USING (auth.uid() = recipient_id)` | `USING (auth.uid() = recipient_id)` | Strictly recipient only. |
| **`user_domains`** | SELECT | *Table did not exist* | `USING (NOT is_blocked((select auth.uid()), user_id))` | Authenticated users can view interest domains of unblocked users. |
| | ALL (mutations)| *Table did not exist* | `USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)` | Users can only manage their own domain memberships. |
| **`domain_messages`** | SELECT | *Table did not exist* | `USING (NOT is_blocked((select auth.uid()), user_id))` | Domain chat messages visible to authenticated users unless sender is blocked. |
| | INSERT | *Table did not exist* | `WITH CHECK ((select auth.uid()) = user_id)` | Authenticated users send as themselves. |
| | DELETE | *Table did not exist* | `USING ((select auth.uid()) = user_id)` | Sender can delete own domain messages. |
| **`verification_requests`**| SELECT | *Table did not exist* | `USING ((select auth.uid()) = user_id)` | **Owner-Only Isolation.** Verification documents and status notes visible only to the requester (and service_role). |
| | INSERT | *Table did not exist* | `WITH CHECK ((select auth.uid()) = user_id)` | Owner can submit verification requests for themselves. |
| **`push_subscriptions`** | ALL | *Table did not exist* | `TO service_role` | **Server-only.** Closed to browser anon and authenticated roles. |
| **`push_idempotency_keys`**| ALL | *Table did not exist* | `TO service_role` | **Server-only.** Closed to browser anon and authenticated roles. |

---

## Hardened Security Definer Helper Functions

All helper functions are marked `SECURITY DEFINER` with `SET search_path = ''` (empty string) to prevent search path hijacking, and use fully-qualified object names (`public.<table_name>`):

```sql
-- 1. Bidirectional Block Check
CREATE OR REPLACE FUNCTION public.is_blocked(_user_a UUID, _user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (blocker_user_id = _user_a AND blocked_user_id = _user_b)
       OR (blocker_user_id = _user_b AND blocked_user_id = _user_a)
  );
$$;

-- 2. User Content Visibility (Public Profile vs Private Followers-Only + Block Check)
CREATE OR REPLACE FUNCTION public.can_view_user_content(_viewer_id UUID, _author_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    _viewer_id = _author_id
    OR (
      NOT public.is_blocked(_viewer_id, _author_id)
      AND (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = _author_id AND is_private = false
        )
        OR EXISTS (
          SELECT 1 FROM public.follow_requests
          WHERE follower_user_id = _viewer_id
            AND following_user_id = _author_id
            AND status = 'accepted'
        )
      )
    )
  );
$$;

-- 3. Post Visibility (POST_VISIBILITY = public-toggle)
CREATE OR REPLACE FUNCTION public.can_view_post(_viewer_id UUID, _post_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    JOIN public.profiles pr ON pr.id = p.user_id
    WHERE p.id = _post_id
      AND (
        p.user_id = _viewer_id
        OR (
          NOT public.is_blocked(_viewer_id, p.user_id)
          AND (
            (p.is_private = false AND pr.is_private = false)
            OR EXISTS (
              SELECT 1 FROM public.follow_requests
              WHERE follower_user_id = _viewer_id
                AND following_user_id = p.user_id
                AND status = 'accepted'
            )
          )
        )
      )
  );
$$;
```

### Access Restrictions on Helper Functions
Arbitrary execution of helper functions by untrusted or anonymous roles is revoked:
- `REVOKE EXECUTE ON FUNCTION public.is_blocked, public.can_view_user_content, public.can_view_post FROM public;`
- `GRANT EXECUTE ON FUNCTION public.is_blocked, public.can_view_user_content, public.can_view_post TO authenticated, service_role;`

### Performance Optimization: `(select auth.uid())`
In PostgreSQL RLS policies, calling `auth.uid()` directly forces the function to be evaluated once per scanned row. Wrapping the call in a scalar subquery `(select auth.uid())` enables PostgreSQL's query optimizer to evaluate the current user ID once per query statement and cache it across row iterations, providing substantial performance gains on large result sets.

### Basic Profile Info vs Private Content
To support search discovery and social connection requests, basic profile info (`id`, `username`, `name`, `avatar_url`, `role`, `is_private`, `is_verified`) in `public.profiles` is queryable by any signed-in user unless a block exists between the viewer and profile owner in either direction. Private content (posts, stories, profile sections) remains strictly protected by `POST_VISIBILITY = public-toggle` and accessible only to accepted followers.
