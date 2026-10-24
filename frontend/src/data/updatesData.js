export const UPDATE_CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'tech', name: 'Tech' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'social_media', name: 'Social Media' },
  { id: 'design', name: 'Design' },
  { id: 'food', name: 'Food' },
  { id: 'ai', name: 'Artificial Intelligence' },
  { id: 'ml', name: 'Machine Learning' },
  { id: 'cybersecurity', name: 'Cybersecurity' },
  { id: 'finance', name: 'Finance' },
  { id: 'business', name: 'Business' },
  { id: 'education', name: 'Education' },
  { id: 'research', name: 'Research' }
];

export function getUpdateCategoryLabel(categoryId) {
  return UPDATE_CATEGORIES.find((category) => category.id === categoryId)?.name || categoryId;
}
