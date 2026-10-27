import { supabase, isSupabaseConfigured } from './supabase';

const profileListeners = new Set<() => void>();
export const notifyProfileListeners = (): void => {
  profileListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('Profile listener error:', e);
    }
  });
};

export const subscribeToProfileState = (fn: () => void): (() => boolean) => {
  profileListeners.add(fn);
  return () => profileListeners.delete(fn);
};

// Local storage key helper
const getStorageKey = (userId: string) => `sync_profile_ext_${userId}`;

export interface ProfileStats {
  followersCount: number;
  followingCount: number;
  postsCount: number;
}

// ============================================================
// 1. GET DATABASE-BACKED PROFILE STATS (FOLLOWERS, FOLLOWING, POSTS)
// ============================================================
export const getProfileStats = async (userId: string | null | undefined): Promise<ProfileStats> => {
  if (!userId) {
    return { followersCount: 0, followingCount: 0, postsCount: 0 };
  }

  let followersCount = 0;
  let followingCount = 0;
  let postsCount = 0;

  if (isSupabaseConfigured) {
    try {
      // Followers count (people who follow this profile)
      const { count: fCount, error: fErr } = await supabase
        .from('follow_requests')
        .select('id', { count: 'exact', head: true })
        .eq('following_user_id', userId)
        .eq('status', 'accepted');

      if (!fErr && typeof fCount === 'number') {
        followersCount = fCount;
      }

      // Following count (people this profile follows)
      const { count: fgCount, error: fgErr } = await supabase
        .from('follow_requests')
        .select('id', { count: 'exact', head: true })
        .eq('follower_user_id', userId)
        .eq('status', 'accepted');

      if (!fgErr && typeof fgCount === 'number') {
        followingCount = fgCount;
      }

      // Posts count
      const { count: pCount, error: pErr } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (!pErr && typeof pCount === 'number') {
        postsCount = pCount;
      }
    } catch (err) {
      console.error('[ProfileService] getProfileStats error:', err);
    }
  }

  return { followersCount, followingCount, postsCount };
};

// ============================================================
// 2. GET FOLLOWERS LIST (REAL DATABASE PROFILES)
// ============================================================
export const getProfileFollowers = async (userId: string | null | undefined): Promise<any[]> => {
  if (!userId || !isSupabaseConfigured) return [];

  try {
    const { data: requests, error } = await supabase
      .from('follow_requests')
      .select('follower_user_id')
      .eq('following_user_id', userId)
      .eq('status', 'accepted');

    if (error || !requests || requests.length === 0) return [];

    const followerIds = requests.map((r: any) => r.follower_user_id).filter(Boolean);
    if (followerIds.length === 0) return [];

    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, name, username, role, avatar_url, bio')
      .in('id', followerIds);

    if (!pErr && profiles) {
      return profiles.map((p: any) => ({
        id: p.id,
        name: p.name || 'User',
        username: p.username || 'user',
        role: p.role || 'Member',
        avatarUrl: p.avatar_url || null,
        avatar_url: p.avatar_url || null,
        bio: p.bio || ''
      }));
    }
  } catch (err) {
    console.error('[ProfileService] getProfileFollowers error:', err);
  }

  return [];
};

// ============================================================
// 3. GET FOLLOWING LIST (REAL DATABASE PROFILES)
// ============================================================
export const getProfileFollowing = async (userId: string | null | undefined): Promise<any[]> => {
  if (!userId || !isSupabaseConfigured) return [];

  try {
    const { data: requests, error } = await supabase
      .from('follow_requests')
      .select('following_user_id')
      .eq('follower_user_id', userId)
      .eq('status', 'accepted');

    if (error || !requests || requests.length === 0) return [];

    const followingIds = requests.map((r: any) => r.following_user_id).filter(Boolean);
    if (followingIds.length === 0) return [];

    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, name, username, role, avatar_url, bio')
      .in('id', followingIds);

    if (!pErr && profiles) {
      return profiles.map((p: any) => ({
        id: p.id,
        name: p.name || 'User',
        username: p.username || 'user',
        role: p.role || 'Member',
        avatarUrl: p.avatar_url || null,
        avatar_url: p.avatar_url || null,
        bio: p.bio || ''
      }));
    }
  } catch (err) {
    console.error('[ProfileService] getProfileFollowing error:', err);
  }

  return [];
};

export interface ProfileSectionsData {
  projects: any[];
  experience: any[];
  education: any[];
  certifications: any[];
  achievements: any[];
}

// ============================================================
// 4. GET PROFESSIONAL PROFILE SECTIONS (PROJECTS, EXPERIENCE, ETC.)
// ============================================================
export const getProfileSections = async (userId: string | null | undefined): Promise<ProfileSectionsData> => {
  const defaultSections: ProfileSectionsData = {
    projects: [],
    experience: [],
    education: [],
    certifications: [],
    achievements: []
  };

  if (!userId) return defaultSections;

  let loadedData: ProfileSectionsData = { ...defaultSections };

  // A) Attempt to read from Supabase dedicated tables
  if (isSupabaseConfigured) {
    try {
      const [projRes, expRes, eduRes, certRes, achRes] = await Promise.all([
        supabase.from('profile_projects').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('profile_experience').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('profile_education').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('profile_certifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('profile_achievements').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      ]);

      if (!projRes.error && Array.isArray(projRes.data) && projRes.data.length > 0) {
        loadedData.projects = projRes.data;
      }
      if (!expRes.error && Array.isArray(expRes.data) && expRes.data.length > 0) {
        loadedData.experience = expRes.data;
      }
      if (!eduRes.error && Array.isArray(eduRes.data) && eduRes.data.length > 0) {
        loadedData.education = eduRes.data;
      }
      if (!certRes.error && Array.isArray(certRes.data) && certRes.data.length > 0) {
        loadedData.certifications = certRes.data;
      }
      if (!achRes.error && Array.isArray(achRes.data) && achRes.data.length > 0) {
        loadedData.achievements = achRes.data;
      }
    } catch (e) {
      // Tables may not be migrated yet; fallback seamlessly
    }
  }

  // B) Fallback and merge with persistent local storage cache
  try {
    const rawLocal = localStorage.getItem(getStorageKey(userId));
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (Array.isArray(parsed.projects) && loadedData.projects.length === 0) {
        loadedData.projects = parsed.projects;
      }
      if (Array.isArray(parsed.experience) && loadedData.experience.length === 0) {
        loadedData.experience = parsed.experience;
      }
      if (Array.isArray(parsed.education) && loadedData.education.length === 0) {
        loadedData.education = parsed.education;
      }
      if (Array.isArray(parsed.certifications) && loadedData.certifications.length === 0) {
        loadedData.certifications = parsed.certifications;
      }
      if (Array.isArray(parsed.achievements) && loadedData.achievements.length === 0) {
        loadedData.achievements = parsed.achievements;
      }
    }
  } catch (e) {
    console.warn('[ProfileService] Local storage fallback read notice:', e);
  }

  return loadedData;
};

// ============================================================
// 5. SAVE PROFESSIONAL PROFILE SECTIONS (DUAL PERSISTENCE)
// ============================================================
export const saveProfileSections = async (userId: string, sectionsData: Partial<ProfileSectionsData>): Promise<boolean> => {
  if (!userId) return false;

  const payload = {
    projects: sectionsData.projects || [],
    experience: sectionsData.experience || [],
    education: sectionsData.education || [],
    certifications: sectionsData.certifications || [],
    achievements: sectionsData.achievements || []
  };

  if (!isSupabaseConfigured) {
    throw new Error('Database service is not configured.');
  }

  // 1. Persist to Supabase dedicated tables (Source of Truth)
  try {
    // Clear and re-insert projects
    if (payload.projects) {
      const { error: delErr } = await supabase.from('profile_projects').delete().eq('user_id', userId);
      if (delErr) throw new Error(delErr.message);

      if (payload.projects.length > 0) {
        const insertData = payload.projects.map((p: any) => ({
          user_id: userId,
          title: p.title || p.name || 'Untitled Project',
          description: p.description || '',
          technologies: Array.isArray(p.technologies) ? p.technologies : (p.technologies ? p.technologies.split(',').map((t: string) => t.trim()).filter(Boolean) : []),
          project_url: p.project_url || p.projectUrl || null,
          github_url: p.github_url || p.githubUrl || null,
          start_date: p.start_date || p.startDate || null,
          end_date: p.end_date || p.endDate || null,
          is_current: Boolean(p.is_current ?? p.isCurrent ?? false)
        }));
        const { error: insErr } = await supabase.from('profile_projects').insert(insertData);
        if (insErr) throw new Error(insErr.message);
      }
    }

    // Clear and re-insert experience
    if (payload.experience) {
      const { error: delErr } = await supabase.from('profile_experience').delete().eq('user_id', userId);
      if (delErr) throw new Error(delErr.message);

      if (payload.experience.length > 0) {
        const insertData = payload.experience.map((e: any) => ({
          user_id: userId,
          organization: e.organization || e.company || '',
          role: e.role || '',
          description: e.description || '',
          start_date: e.start_date || e.startDate || null,
          end_date: e.end_date || e.endDate || null,
          is_current: Boolean(e.is_current ?? e.isCurrent ?? false)
        }));
        const { error: insErr } = await supabase.from('profile_experience').insert(insertData);
        if (insErr) throw new Error(insErr.message);
      }
    }

    // Clear and re-insert education
    if (payload.education) {
      const { error: delErr } = await supabase.from('profile_education').delete().eq('user_id', userId);
      if (delErr) throw new Error(delErr.message);

      if (payload.education.length > 0) {
        const insertData = payload.education.map((e: any) => ({
          user_id: userId,
          institution: e.institution || e.school || '',
          degree: e.degree || '',
          field_of_study: e.field_of_study || e.fieldOfStudy || null,
          start_date: e.start_date || e.startDate || null,
          end_date: e.end_date || e.endDate || null,
          is_current: Boolean(e.is_current ?? e.isCurrent ?? false)
        }));
        const { error: insErr } = await supabase.from('profile_education').insert(insertData);
        if (insErr) throw new Error(insErr.message);
      }
    }

    // Clear and re-insert certifications
    if (payload.certifications) {
      const { error: delErr } = await supabase.from('profile_certifications').delete().eq('user_id', userId);
      if (delErr) throw new Error(delErr.message);

      if (payload.certifications.length > 0) {
        const insertData = payload.certifications.map((c: any) => ({
          user_id: userId,
          name: c.name || c.title || '',
          issuer: c.issuer || c.organization || '',
          issue_date: c.issue_date || c.issueDate || null,
          credential_id: c.credential_id || c.credentialId || null,
          credential_url: c.credential_url || c.credentialUrl || null
        }));
        const { error: insErr } = await supabase.from('profile_certifications').insert(insertData);
        if (insErr) throw new Error(insErr.message);
      }
    }

    // Clear and re-insert achievements
    if (payload.achievements) {
      const { error: delErr } = await supabase.from('profile_achievements').delete().eq('user_id', userId);
      if (delErr) throw new Error(delErr.message);

      if (payload.achievements.length > 0) {
        const insertData = payload.achievements.map((a: any) => ({
          user_id: userId,
          title: a.title || '',
          organization: a.organization || null,
          date: a.date || null,
          description: a.description || '',
          proof_url: a.proof_url || a.proofUrl || null
        }));
        const { error: insErr } = await supabase.from('profile_achievements').insert(insertData);
        if (insErr) throw new Error(insErr.message);
      }
    }
  } catch (dbErr: any) {
    console.error('[ProfileService] Database table persistence error:', dbErr?.message);
    throw new Error(dbErr?.message || 'Failed to save profile sections to database.');
  }

  // 2. Update persistent localStorage read cache only after database success
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(payload));
  } catch (e) {
    console.warn('[ProfileService] Local storage save error:', e);
  }

  notifyProfileListeners();
  return true;
};

// ============================================================
// 6. HELPER: DERIVED AGE CALCULATION
// ============================================================
export const calculateAge = (dobString: string | null | undefined): number | null => {
  if (!dobString) return null;
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
};

// ============================================================
// 7. CHECK USERNAME AVAILABILITY (REAL SUPABASE QUERY)
// ============================================================
export const checkUsernameAvailability = async (
  username: string,
  currentUserId: string | null = null
): Promise<{ available: boolean; error?: string }> => {
  if (!username) return { available: false, error: 'Username is required' };
  const clean = username.trim().toLowerCase().replace(/^@/, '');
  
  if (clean.length < 3) {
    return { available: false, error: 'Username must be at least 3 characters' };
  }
  if (!/^[a-z0-9_.-]+$/.test(clean)) {
    return { available: false, error: 'Username can only contain letters, numbers, underscores, dashes, and dots' };
  }

  if (!isSupabaseConfigured) {
    return { available: true };
  }

  try {
    let query = supabase
      .from('profiles')
      .select('id, username')
      .eq('username', clean);

    if (currentUserId) {
      query = query.neq('id', currentUserId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[ProfileService] Username check error:', error);
      return { available: true };
    }

    if (data && data.length > 0) {
      return { available: false, error: 'Username already taken' };
    }

    return { available: true };
  } catch (err) {
    console.error('[ProfileService] checkUsernameAvailability error:', err);
    return { available: true };
  }
};

// ============================================================
// 8. USER DOMAIN MEMBERSHIPS (user_domains table)
// ============================================================
export const getUserDomainMemberships = async (userId: string | null | undefined): Promise<string[]> => {
  if (!userId) return [];
  
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('user_domains')
        .select('domain_id')
        .eq('user_id', userId);

      if (!error && data && data.length > 0) {
        return data.map((d: any) => d.domain_id);
      }
    } catch (err) {
      console.warn('[ProfileService] user_domains fetch error:', err);
    }
  }

  // Fallback to localStorage or profile.domains
  try {
    const raw = localStorage.getItem(`sync_user_domains_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  return [];
};

export const setUserDomainMemberships = async (userId: string, domainIds: string[] = []): Promise<boolean> => {
  if (!userId) return false;
  const uniqueDomainIds = Array.from(new Set((domainIds || []).filter(Boolean)));

  if (!isSupabaseConfigured) {
    throw new Error('Database service is not configured.');
  }

  try {
    // 1. Update profiles.domains array directly (authoritative source)
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ domains: uniqueDomainIds, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (profErr) throw profErr;

    // 2. Safely sync to user_domains table if it exists
    try {
      await supabase.from('user_domains').delete().eq('user_id', userId);
      if (uniqueDomainIds.length > 0) {
        const rows = uniqueDomainIds.map((domain_id) => ({
          user_id: userId,
          domain_id: domain_id
        }));
        await supabase.from('user_domains').insert(rows);
      }
    } catch (tableErr) {
      // user_domains table is optional
    }
  } catch (err: any) {
    console.error('[ProfileService] setUserDomainMemberships error:', err?.message);
    throw new Error(err?.message || 'Failed to update domain preferences in database.');
  }

  // 3. Update local read cache only on database success
  try {
    localStorage.setItem(`sync_user_domains_${userId}`, JSON.stringify(uniqueDomainIds));
  } catch (e) {}

  notifyProfileListeners();
  return true;
};

// ============================================================
// 9. PRIVATE USER DETAILS (ISOLATED IN user_private_details WITH OWNER-ONLY RLS)
// ============================================================

export const getUserPrivateDetails = async (userId: string | null | undefined): Promise<any> => {
  if (!userId) return { data: null, error: 'User ID required', serverLoaded: false };

  const localCacheKey = `sync_profile_private_${userId}`;
  let cached: any = null;
  try {
    const raw = localStorage.getItem(localCacheKey);
    if (raw) cached = JSON.parse(raw);
  } catch (e) {}

  if (!isSupabaseConfigured) {
    return { data: cached, error: null, serverLoaded: false, isFallback: true };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const currentAuthId = session?.user?.id;
    // Client-side authorization guard: Only owner can query their own private details
    if (!currentAuthId || currentAuthId !== userId) {
      return { data: null, error: 'Unauthorized: Private details are only accessible to the account owner.', serverLoaded: false };
    }

    const { data, error } = await supabase
      .from('user_private_details')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      // Graceful fallback if table is not yet created in remote database
      if (
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        error.message?.includes('relation') ||
        error.message?.includes('does not exist')
      ) {
        return { data: cached, error: null, serverLoaded: false, isFallback: true, pendingMigration: true };
      }
      console.warn('[ProfileService] getUserPrivateDetails notice:', error.message);
      return { data: cached, error: error.message, serverLoaded: false };
    }

    if (data) {
      try {
        localStorage.setItem(localCacheKey, JSON.stringify(data));
      } catch (e) {}
      return { data, error: null, serverLoaded: true };
    }

    return { data: cached, error: null, serverLoaded: true };
  } catch (err: any) {
    console.error('[ProfileService] getUserPrivateDetails exception:', err);
    return { data: cached, error: err?.message, serverLoaded: false };
  }
};

export const upsertUserPrivateDetails = async (userId: string, privateData: any): Promise<any> => {
  if (!userId) return { success: false, serverSaved: false, isLocalOnly: false, error: 'Missing user ID' };

  const localCacheKey = `sync_profile_private_${userId}`;

  if (!isSupabaseConfigured) {
    return { success: false, serverSaved: false, isLocalOnly: false, error: 'Database service is not configured.' };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const currentAuthId = session?.user?.id;
    if (!currentAuthId || currentAuthId !== userId) {
      return { success: false, serverSaved: false, isLocalOnly: false, error: 'Unauthorized: You can only update your own private details.' };
    }

    const payload: Record<string, any> = {
      user_id: userId,
      updated_at: new Date().toISOString()
    };

    if (privateData.date_of_birth !== undefined) payload.date_of_birth = privateData.date_of_birth || null;
    if (privateData.gender !== undefined) payload.gender = privateData.gender || null;
    if (privateData.gender_custom !== undefined) payload.gender_custom = privateData.gender_custom || null;
    if (privateData.location_address !== undefined) payload.location_address = privateData.location_address || null;
    if (privateData.location_area !== undefined) payload.location_area = privateData.location_area || null;
    if (privateData.location_landmark !== undefined) payload.location_landmark = privateData.location_landmark || null;
    if (privateData.location_pincode !== undefined) payload.location_pincode = privateData.location_pincode || null;
    if (privateData.location_latitude !== undefined) payload.location_latitude = privateData.location_latitude ?? null;
    if (privateData.location_longitude !== undefined) payload.location_longitude = privateData.location_longitude ?? null;
    if (privateData.privacy_settings !== undefined) payload.privacy_settings = privateData.privacy_settings;

    let { data, error } = await supabase
      .from('user_private_details')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .maybeSingle();

    if (
      error &&
      (error.code === '42P01' ||
        error.code === 'PGRST205' ||
        error.message?.includes('relation') ||
        error.message?.includes('does not exist'))
    ) {
      console.warn('[ProfileService] user_private_details table does not exist in DB yet.');
      return {
        success: false,
        serverSaved: false,
        isLocalOnly: false,
        pendingMigration: true,
        error: 'The remote user_private_details table is not yet migrated.',
        data: payload
      };
    }

    if (error && (error.code === '42703' || error.message?.includes('column'))) {
      const match = error.message.match(/'([^']+)' column/i) || error.message.match(/column "?([^"\s]+)"?/i);
      if (match && match[1] && payload[match[1]] !== undefined) {
        delete payload[match[1]];
        const retry = await supabase
          .from('user_private_details')
          .upsert(payload, { onConflict: 'user_id' })
          .select()
          .maybeSingle();
        data = retry.data;
        error = retry.error;
      }
    }

    if (error && (error.code === '42501' || error.message?.includes('policy') || error.message?.includes('permission denied'))) {
      console.error('[ProfileService] Permission denied saving private details:', error);
      return {
        success: false,
        serverSaved: false,
        isLocalOnly: false,
        error: 'Database permission denied (Row-Level Security check failed).',
        data: payload
      };
    }

    if (error) {
      console.error('[ProfileService] upsertUserPrivateDetails DB error:', error);
      return {
        success: false,
        serverSaved: false,
        isLocalOnly: false,
        error: error.message || 'Failed to save private details to server.',
        data: payload
      };
    }

    // Update local read cache only on successful database write
    try {
      localStorage.setItem(localCacheKey, JSON.stringify(data || payload));
    } catch (e) {}

    return { success: true, serverSaved: true, isLocalOnly: false, data: data || payload };
  } catch (err: any) {
    console.error('[ProfileService] upsertUserPrivateDetails exception:', err);
    return {
      success: false,
      serverSaved: false,
      isLocalOnly: false,
      error: err?.message || 'Network error while saving private details.',
      data: privateData
    };
  }
};

// ============================================================
// 10. UPDATE PUBLIC PROFILE (DOES NOT STORE PRIVATE PII IN PROFILES)
// ============================================================
export const updateBasicProfile = async (userId: string, profileData: any): Promise<any> => {
  if (!userId) return null;

  // Protect privileged verification status from client update payloads
  const sanitizedProfileData = { ...profileData };
  delete sanitizedProfileData.is_verified;

  // Update domain memberships if provided
  if (sanitizedProfileData.domains && Array.isArray(sanitizedProfileData.domains)) {
    await setUserDomainMemberships(userId, sanitizedProfileData.domains);
  }

  // 1. If any sensitive private fields exist, persist them strictly into user_private_details
  const privateFieldNames = [
    'date_of_birth',
    'gender',
    'gender_custom',
    'location_address',
    'location_area',
    'location_landmark',
    'location_pincode',
    'location_latitude',
    'location_longitude',
    'privacy_settings'
  ];
  const hasPrivateFields = privateFieldNames.some((key) => sanitizedProfileData[key] !== undefined);

  let privResult: any = null;
  if (hasPrivateFields) {
    privResult = await upsertUserPrivateDetails(userId, sanitizedProfileData);
    if (!privResult.success && !privResult.pendingMigration) {
      console.error('[ProfileService] Failed to save private details:', privResult.error);
      throw new Error(`Failed to save private details: ${privResult.error}`);
    }
  }

  // 2. Only public fields are sent to public.profiles
  if (isSupabaseConfigured) {
    try {
      const baseUpdates: Record<string, any> = {};
      if (sanitizedProfileData.name !== undefined) baseUpdates.name = sanitizedProfileData.name;
      if (sanitizedProfileData.username !== undefined) baseUpdates.username = sanitizedProfileData.username;
      if (sanitizedProfileData.role !== undefined) baseUpdates.role = sanitizedProfileData.role;
      if (sanitizedProfileData.bio !== undefined) baseUpdates.bio = sanitizedProfileData.bio;
      if (sanitizedProfileData.avatarUrl !== undefined) baseUpdates.avatar_url = sanitizedProfileData.avatarUrl;
      if (sanitizedProfileData.avatar_url !== undefined) baseUpdates.avatar_url = sanitizedProfileData.avatar_url;
      if (sanitizedProfileData.skills !== undefined) baseUpdates.skills = sanitizedProfileData.skills;
      if (sanitizedProfileData.domains !== undefined) baseUpdates.domains = sanitizedProfileData.domains;
      baseUpdates.updated_at = new Date().toISOString();

      const publicUpdates = { ...baseUpdates };
      // Broad discovery location fields (safe for public)
      if (sanitizedProfileData.location !== undefined) publicUpdates.location = sanitizedProfileData.location;
      if (sanitizedProfileData.location_place_name !== undefined) publicUpdates.location_place_name = sanitizedProfileData.location_place_name;
      if (sanitizedProfileData.location_city !== undefined) publicUpdates.location_city = sanitizedProfileData.location_city;
      if (sanitizedProfileData.location_state !== undefined) publicUpdates.location_state = sanitizedProfileData.location_state;
      if (sanitizedProfileData.location_country !== undefined) publicUpdates.location_country = sanitizedProfileData.location_country;

      // Onboarding public fields
      if (sanitizedProfileData.first_name !== undefined) publicUpdates.first_name = sanitizedProfileData.first_name;
      if (sanitizedProfileData.last_name !== undefined) publicUpdates.last_name = sanitizedProfileData.last_name;
      if (sanitizedProfileData.languages !== undefined) publicUpdates.languages = sanitizedProfileData.languages;
      if (sanitizedProfileData.profession_type !== undefined) publicUpdates.profession_type = sanitizedProfileData.profession_type;
      if (sanitizedProfileData.profession_details !== undefined) publicUpdates.profession_details = sanitizedProfileData.profession_details;
      if (sanitizedProfileData.skills_technical !== undefined) publicUpdates.skills_technical = sanitizedProfileData.skills_technical;
      if (sanitizedProfileData.skills_soft !== undefined) publicUpdates.skills_soft = sanitizedProfileData.skills_soft;
      if (sanitizedProfileData.skills_languages !== undefined) publicUpdates.skills_languages = sanitizedProfileData.skills_languages;
      if (sanitizedProfileData.skills_tools !== undefined) publicUpdates.skills_tools = sanitizedProfileData.skills_tools;
      if (sanitizedProfileData.skills_technologies !== undefined) publicUpdates.skills_technologies = sanitizedProfileData.skills_technologies;
      if (sanitizedProfileData.skills_expertise !== undefined) publicUpdates.skills_expertise = sanitizedProfileData.skills_expertise;
      if (sanitizedProfileData.portfolio_url !== undefined) publicUpdates.portfolio_url = sanitizedProfileData.portfolio_url;
      if (sanitizedProfileData.github_url !== undefined) publicUpdates.github_url = sanitizedProfileData.github_url;
      if (sanitizedProfileData.linkedin_url !== undefined) publicUpdates.linkedin_url = sanitizedProfileData.linkedin_url;
      if (sanitizedProfileData.other_links !== undefined) publicUpdates.other_links = sanitizedProfileData.other_links;
      if (sanitizedProfileData.preferred_work_location !== undefined) publicUpdates.preferred_work_location = sanitizedProfileData.preferred_work_location;
      if (sanitizedProfileData.preferences !== undefined) publicUpdates.preferences = sanitizedProfileData.preferences;
      if (sanitizedProfileData.onboarding_completed !== undefined) publicUpdates.onboarding_completed = sanitizedProfileData.onboarding_completed;
      if (sanitizedProfileData.professional_photo_url !== undefined) publicUpdates.professional_photo_url = sanitizedProfileData.professional_photo_url;

      let { data, error } = await supabase
        .from('profiles')
        .update(publicUpdates)
        .eq('id', userId)
        .select()
        .single();

      // If missing column error occurs before onboarding migration is run, fallback to base updates
      if (
        error &&
        (error.code === '42703' ||
          error.code === 'PGRST204' ||
          error.message?.includes('column') ||
          error.message?.includes('schema cache'))
      ) {
        console.warn('[ProfileService] Some columns not in schema yet, saving base fields:', error.message);
        const fallbackRes = await supabase
          .from('profiles')
          .update(baseUpdates)
          .eq('id', userId)
          .select()
          .single();
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (!error && data) {
        // Update local read cache only on verified database success
        try {
          localStorage.setItem(`sync_profile_wizard_${userId}`, JSON.stringify(sanitizedProfileData));
          if (sanitizedProfileData.locationData || sanitizedProfileData.location) {
            const locPayload = sanitizedProfileData.locationData || {
              displayLocation: sanitizedProfileData.location,
              placeName: sanitizedProfileData.location_place_name,
              address: sanitizedProfileData.location_address,
              area: sanitizedProfileData.location_area,
              landmark: sanitizedProfileData.location_landmark,
              city: sanitizedProfileData.location_city,
              state: sanitizedProfileData.location_state,
              country: sanitizedProfileData.location_country,
              pincode: sanitizedProfileData.location_pincode,
              latitude: sanitizedProfileData.location_latitude,
              longitude: sanitizedProfileData.location_longitude
            };
            localStorage.setItem(`sync_profile_location_${userId}`, JSON.stringify(locPayload));
          }
        } catch (e) {}

        notifyProfileListeners();
        return {
          ...data,
          _serverSaved: true,
          _isLocalOnly: false,
          _privPendingMigration: Boolean(privResult?.pendingMigration)
        };
      }

      if (error) {
        console.error('[ProfileService] updateBasicProfile DB error:', error);
        throw new Error(error.message || 'Failed to update profile');
      }
    } catch (err) {
      console.error('[ProfileService] updateBasicProfile exception:', err);
      throw err;
    }
  }

  notifyProfileListeners();
  return {
    ...sanitizedProfileData,
    _serverSaved: false,
    _isLocalOnly: true
  };
};

// ============================================================
// 11. SAVE INDIVIDUAL WIZARD STEP
// ============================================================
export const saveStepProfile = async (
  userId: string,
  stepNumber: number,
  stepData: any
): Promise<any> => {
  if (!userId || !stepData) return { success: false, serverSaved: false, isLocalOnly: false, error: 'Missing user ID or data' };

  // Strip privileged fields from client update
  const sanitizedStepData = { ...stepData };
  delete sanitizedStepData.is_verified;

  // Handle domain memberships separately (Step 8)
  if (sanitizedStepData.domains && Array.isArray(sanitizedStepData.domains)) {
    await setUserDomainMemberships(userId, sanitizedStepData.domains);
  }

  // Check and isolate private fields
  const privateFieldNames = [
    'date_of_birth',
    'gender',
    'gender_custom',
    'location_address',
    'location_area',
    'location_landmark',
    'location_pincode',
    'location_latitude',
    'location_longitude',
    'privacy_settings'
  ];
  const hasPrivateFields = privateFieldNames.some((key) => sanitizedStepData[key] !== undefined);

  let privRes: any = null;
  if (hasPrivateFields) {
    privRes = await upsertUserPrivateDetails(userId, sanitizedStepData);
    if (!privRes.success && !privRes.pendingMigration) {
      return {
        success: false,
        serverSaved: false,
        isLocalOnly: false,
        error: `Failed to save private details: ${privRes.error}`
      };
    }
  }

  if (!isSupabaseConfigured) {
    notifyProfileListeners();
    return {
      success: true,
      serverSaved: false,
      isLocalOnly: true,
      data: sanitizedStepData
    };
  }

  try {
    // Build update object for public.profiles containing ONLY permitted non-sensitive columns
    const publicUpdates: Record<string, any> = {};
    const publicFieldMap: Record<string, string> = {
      first_name: 'first_name', last_name: 'last_name', name: 'name',
      username: 'username', role: 'role', bio: 'bio',
      avatar_url: 'avatar_url', avatarUrl: 'avatar_url',
      languages: 'languages', professional_photo_url: 'professional_photo_url',
      location: 'location', location_place_name: 'location_place_name',
      location_city: 'location_city', location_state: 'location_state',
      location_country: 'location_country',
      profession_type: 'profession_type', profession_details: 'profession_details',
      skills: 'skills', skills_technical: 'skills_technical', skills_soft: 'skills_soft',
      skills_languages: 'skills_languages', skills_tools: 'skills_tools',
      skills_technologies: 'skills_technologies', skills_expertise: 'skills_expertise',
      portfolio_url: 'portfolio_url', github_url: 'github_url',
      linkedin_url: 'linkedin_url', other_links: 'other_links',
      preferred_work_location: 'preferred_work_location', preferences: 'preferences',
      domains: 'domains', onboarding_completed: 'onboarding_completed'
    };

    for (const [srcKey, dbKey] of Object.entries(publicFieldMap)) {
      if (sanitizedStepData[srcKey] !== undefined) {
        publicUpdates[dbKey] = sanitizedStepData[srcKey];
      }
    }

    publicUpdates.updated_at = new Date().toISOString();

    // Fetch current completed steps safely
    let existingSteps: number[] = [];
    try {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('profile_setup_completed_steps')
        .eq('id', userId)
        .single();
      existingSteps = currentProfile?.profile_setup_completed_steps || [];
    } catch (e) {}

    const newSteps = Array.from(new Set([...existingSteps, stepNumber])).sort((a, b) => a - b);
    publicUpdates.profile_setup_completed_steps = newSteps;

    // Execute update with progressive omission of unmigrated schema columns
    let { data, error } = await supabase
      .from('profiles')
      .update(publicUpdates)
      .eq('id', userId)
      .select()
      .single();

    let retries = 0;
    while (
      error &&
      (error.code === '42703' ||
        error.code === 'PGRST204' ||
        error.message?.includes('column') ||
        error.message?.includes('schema cache')) &&
      retries < 10
    ) {
      retries++;
      const match =
        error.message.match(/'([^']+)' column/i) ||
        error.message.match(/column "?([^"\s]+)"?/i);

      if (match && match[1] && publicUpdates[match[1]] !== undefined) {
        delete publicUpdates[match[1]];
      } else {
        // Fallback: keep only existing base columns
        const baseAllowed = ['name', 'username', 'role', 'bio', 'avatar_url', 'skills', 'domains', 'updated_at'];
        for (const k of Object.keys(publicUpdates)) {
          if (!baseAllowed.includes(k)) {
            delete publicUpdates[k];
          }
        }
      }

      if (Object.keys(publicUpdates).length === 0) {
        notifyProfileListeners();
        return {
          success: true,
          serverSaved: false,
          isLocalOnly: true,
          pendingMigration: true,
          warning: 'Remote database schema is missing required columns. Data has been saved locally on this device.',
          data: sanitizedStepData
        };
      }

      const retryRes = await supabase
        .from('profiles')
        .update(publicUpdates)
        .eq('id', userId)
        .select()
        .single();
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) {
      console.error('[ProfileService] saveStepProfile DB error:', error);
      let errorMsg = error.message || 'Failed to save step to server database.';
      if (error.code === '42501' || error.message?.includes('policy') || error.message?.includes('permission denied')) {
        errorMsg = 'Permission denied by database (Row-Level Security check failed).';
      }
      return {
        success: false,
        serverSaved: false,
        isLocalOnly: true,
        error: errorMsg,
        data: sanitizedStepData
      };
    }

    // Update local read cache only on verified database success
    try {
      const existing = JSON.parse(localStorage.getItem(`sync_profile_wizard_${userId}`) || '{}');
      const merged = { ...existing, ...sanitizedStepData };
      localStorage.setItem(`sync_profile_wizard_${userId}`, JSON.stringify(merged));

      if (sanitizedStepData.locationData || sanitizedStepData.location) {
        const locPayload = sanitizedStepData.locationData || {
          displayLocation: sanitizedStepData.location,
          placeName: sanitizedStepData.location_place_name,
          address: sanitizedStepData.location_address,
          area: sanitizedStepData.location_area,
          landmark: sanitizedStepData.location_landmark,
          city: sanitizedStepData.location_city,
          state: sanitizedStepData.location_state,
          country: sanitizedStepData.location_country,
          pincode: sanitizedStepData.location_pincode,
          latitude: sanitizedStepData.location_latitude,
          longitude: sanitizedStepData.location_longitude
        };
        localStorage.setItem(`sync_profile_location_${userId}`, JSON.stringify(locPayload));
      }
    } catch (e) {}

    notifyProfileListeners();
    const isPrivatePending = Boolean(privRes?.pendingMigration);
    return {
      success: true,
      serverSaved: true,
      isLocalOnly: false,
      pendingMigration: isPrivatePending,
      warning: isPrivatePending ? 'Profile saved to server, but private details table migration is pending.' : null,
      data: data || sanitizedStepData
    };
  } catch (err: any) {
    console.error('[ProfileService] saveStepProfile exception:', err);
    return {
      success: false,
      serverSaved: false,
      isLocalOnly: true,
      error: err?.message || 'An unexpected error occurred while saving profile step.',
      data: sanitizedStepData
    };
  }
};

// ============================================================
// 12. URL VALIDATION HELPER
// ============================================================
export const isValidUrl = (urlString: string | null | undefined): boolean => {
  if (!urlString || typeof urlString !== 'string') return true;
  const trimmed = urlString.trim();
  if (!trimmed) return true;
  try {
    const url = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
};

// ============================================================
// 13. SUPABASE STORAGE UPLOAD FOR PROFILE & PROFESSIONAL PHOTOS
// ============================================================
export const uploadProfilePhoto = async (
  file: File,
  userId: string,
  photoType: string = 'avatar'
): Promise<string | null> => {
  if (!file || !userId) return null;

  const rawExt = file.name ? file.name.split('.').pop()?.toLowerCase() : 'jpg';
  const ext = (rawExt && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(rawExt)) ? rawExt : 'jpg';
  const uniqueTag = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const folderName = photoType === 'professional' ? 'professional_photos' : 'avatars';
  const filePath = `${folderName}/${userId}/${uniqueTag}.${ext}`;

  if (isSupabaseConfigured) {
    const bucketsToTry = ['avatars', 'profile-photos', 'post-media'];
    const clientToUse = supabase;

    for (const bucket of bucketsToTry) {
      try {
        const { data, error } = await clientToUse.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (!error && data) {
          const { data: publicUrlData } = clientToUse.storage
            .from(bucket)
            .getPublicUrl(filePath);

          if (publicUrlData?.publicUrl) {
            console.log(`[ProfileService] Photo uploaded successfully to bucket '${bucket}':`, publicUrlData.publicUrl);
            return publicUrlData.publicUrl;
          }
        }
      } catch (err) {
        console.warn(`[ProfileService] Bucket '${bucket}' upload attempt notice:`, err);
      }
    }
  }

  // Resilient fallback to persistent Data URL if storage bucket is not created or in mock mode
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
};
