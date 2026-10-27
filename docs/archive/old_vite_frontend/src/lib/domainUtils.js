/**
 * Helper utility for domain slug and name normalization.
 * Maps between domain IDs (e.g. 'tech', 'social_media') and display names (e.g. 'Technology', 'Social Media').
 */

export const DOMAIN_MAPPINGS = {
  tech: ['tech', 'technology'],
  technology: ['tech', 'technology'],
  marketing: ['marketing'],
  social_media: ['social_media', 'social media', 'social'],
  social: ['social_media', 'social media', 'social'],
  design: ['design', 'ui/ux', 'product design'],
  food: ['food', 'culinary'],
  ai: ['ai', 'artificial intelligence'],
  ml: ['ml', 'machine learning'],
  cybersecurity: ['cybersecurity', 'security'],
  finance: ['finance', 'fintech'],
  business: ['business', 'management']
};

/**
 * Checks if a user's domain list includes the given domainId or domainName.
 * Handles slug variations, title variations, and case differences.
 *
 * @param {Array<string>} userDomains - Array of domain strings from user profile or cache
 * @param {string} domainId - Domain identifier (e.g. 'tech')
 * @param {string} domainName - Domain display name (e.g. 'Technology')
 * @returns {boolean}
 */
export function checkIsDomainMember(userDomains = [], domainId = '', domainName = '') {
  if (!userDomains || !Array.isArray(userDomains) || userDomains.length === 0) {
    return false;
  }

  const cleanId = (domainId || '').toLowerCase().trim();
  const cleanName = (domainName || '').toLowerCase().trim();

  // Get known synonyms for this domain
  const synonyms = new Set([
    cleanId,
    cleanName,
    ...(DOMAIN_MAPPINGS[cleanId] || []),
    ...(DOMAIN_MAPPINGS[cleanName] || [])
  ]);

  return userDomains.some((d) => {
    if (!d || typeof d !== 'string') return false;
    const lower = d.toLowerCase().trim();
    if (synonyms.has(lower)) return true;
    if (lower.replace(/\s+/g, '_') === cleanId) return true;
    if (cleanId.replace(/\s+/g, '_') === lower) return true;
    return false;
  });
}
