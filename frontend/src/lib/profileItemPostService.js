import { createPost } from './postService';

export const ITEM_TYPE_LABELS = {
  project: 'Shared a project',
  experience: 'Shared an experience',
  education: 'Shared an education milestone',
  certification: 'Shared a certification',
  achievement: 'Shared an achievement'
};

export const ITEM_TYPE_ICONS = {
  project: '📁',
  experience: '💼',
  education: '🎓',
  certification: '📜',
  achievement: '🏆'
};

/**
 * Format item details into a standardized metadata snapshot
 */
export function extractItemDetails(itemType, item) {
  if (!item) return {};

  switch (itemType) {
    case 'project':
      return {
        title: item.title || 'Untitled Project',
        subtitle: item.project_url || item.projectUrl || '',
        description: item.description || '',
        tags: Array.isArray(item.technologies) ? item.technologies : [],
        link: item.project_url || item.projectUrl || null,
        imageUrl: item.image_url || item.imageUrl || null,
        date: item.is_current ? 'In Progress' : (item.end_date || item.start_date || '')
      };

    case 'experience':
      return {
        title: item.role || item.job_title || 'Position',
        subtitle: `${item.organization || item.company || ''}${item.location ? ` • ${item.location}` : ''}`,
        description: item.description || '',
        tags: Array.isArray(item.skills) ? item.skills : [],
        link: null,
        imageUrl: null,
        date: item.is_current ? 'Present' : (item.end_date || item.start_date || '')
      };

    case 'education':
      return {
        title: `${item.degree || 'Degree'}${item.field_of_study ? ` in ${item.field_of_study}` : ''}`,
        subtitle: `${item.institution || 'Institution'}${item.location ? ` • ${item.location}` : ''}`,
        description: item.description || '',
        tags: Array.isArray(item.skills) ? item.skills : [],
        link: null,
        imageUrl: null,
        date: item.is_current ? 'Currently Studying' : (item.end_date || item.start_date || '')
      };

    case 'certification':
      return {
        title: item.name || 'Certification',
        subtitle: `Issued by ${item.issuer || 'Issuer'}`,
        description: item.credential_id ? `Credential ID: ${item.credential_id}` : '',
        tags: Array.isArray(item.skills) ? item.skills : [],
        link: item.credential_url || item.credentialUrl || null,
        imageUrl: item.image_url || item.imageUrl || null,
        date: item.issue_date || item.issueDate || ''
      };

    case 'achievement':
      return {
        title: item.title || 'Achievement',
        subtitle: item.organization ? `Conferred by ${item.organization}` : '',
        description: item.description || '',
        tags: Array.isArray(item.skills) ? item.skills : [],
        link: item.credential_url || item.proof_url || null,
        imageUrl: item.image_url || item.imageUrl || null,
        date: item.achievement_date || item.date || ''
      };

    default:
      return {
        title: item.title || item.name || 'Profile Item',
        subtitle: '',
        description: item.description || '',
        tags: [],
        link: null,
        imageUrl: null,
        date: ''
      };
  }
}

/**
 * Parse a post content string to check for an attached profile item snapshot
 */
export function parseProfileItemRef(content) {
  if (!content || typeof content !== 'string') {
    return { caption: '', itemRef: null };
  }

  const markerRegex = /<!--SYNC_ITEM_REF:([\s\S]*?)-->/;
  const match = content.match(markerRegex);

  if (!match) {
    return { caption: content.trim(), itemRef: null };
  }

  let itemRef = null;
  try {
    itemRef = JSON.parse(match[1]);
  } catch (err) {
    console.warn('[ProfileItemPostService] Error parsing itemRef JSON:', err);
  }

  const cleanCaption = content.replace(markerRegex, '').trim();
  return { caption: cleanCaption, itemRef };
}

/**
 * Create a real Supabase feed post based on a profile item
 */
export async function createProfileItemPost({
  userId,
  itemType,
  item,
  caption = '',
  domain = 'tech'
}) {
  if (!userId || !itemType || !item?.id) {
    throw new Error('User ID, item type, and valid item record are required to create a post.');
  }

  const details = extractItemDetails(itemType, item);
  const shareLabel = ITEM_TYPE_LABELS[itemType] || 'Shared a profile item';

  const metadata = {
    source_type: itemType,
    source_id: item.id,
    owner_id: userId,
    share_label: shareLabel,
    icon: ITEM_TYPE_ICONS[itemType] || '📌',
    title: details.title,
    subtitle: details.subtitle,
    description: details.description,
    tags: details.tags,
    link: details.link,
    image_url: details.imageUrl,
    date: details.date,
    created_at: new Date().toISOString()
  };

  const userCaption = caption ? caption.trim() : '';
  const postTitle = `${shareLabel}: ${details.title}`;
  const serializedMetadata = `<!--SYNC_ITEM_REF:${JSON.stringify(metadata)}-->`;

  // Content includes the user caption (or announcement fallback) + metadata comment
  const contentString = userCaption
    ? `${userCaption}\n\n${serializedMetadata}`
    : `${shareLabel}: ${details.title}\n\n${serializedMetadata}`;

  const postPayload = {
    authorId: userId,
    domain: domain || 'tech',
    title: postTitle,
    content: contentString,
    mediaType: details.imageUrl ? 'image' : 'text',
    mediaUrl: details.imageUrl || null
  };

  const createdPost = await createPost(postPayload);
  return createdPost;
}

/**
 * Share a specific progress update to the main Feed
 */
export async function shareUpdateToFeed({
  userId,
  update,
  itemType,
  item,
  caption = '',
  domain = 'tech'
}) {
  if (!userId || !update?.id || !item?.id) {
    throw new Error('User ID, update record, and parent item record are required to share an update.');
  }

  const details = extractItemDetails(itemType, item);
  const shareLabel = `Shared an update on ${itemType}`;

  const metadata = {
    source_type: `${itemType}_update`,
    source_id: update.id,
    parent_id: item.id,
    owner_id: userId,
    share_label: shareLabel,
    icon: ITEM_TYPE_ICONS[itemType] || '📌',
    title: update.title || `Update on ${details.title}`,
    subtitle: `${details.title} (${update.status || 'Updated'})`,
    description: update.content || '',
    status: update.status || 'In Progress',
    image_url: update.image_url || null,
    date: update.created_at || new Date().toISOString()
  };

  const userCaption = caption ? caption.trim() : '';
  const postTitle = `Update: ${metadata.title}`;
  const serializedMetadata = `<!--SYNC_ITEM_REF:${JSON.stringify(metadata)}-->`;

  const contentString = userCaption
    ? `${userCaption}\n\n${serializedMetadata}`
    : `📢 ${shareLabel}: ${metadata.title}\n\n${serializedMetadata}`;

  const postPayload = {
    authorId: userId,
    domain: domain || 'tech',
    title: postTitle,
    content: contentString,
    mediaType: update.image_url ? 'image' : 'text',
    mediaUrl: update.image_url || null
  };

  const createdPost = await createPost(postPayload);
  return createdPost;
}
