export const initialChannels = [
  { id: 'general', title: '# General' },
  { id: 'doubt', title: '? Doubt' },
  { id: 'work_job', title: '◦ Work / Job' }
];

export const domains = [
  {
    id: 'tech',
    name: 'Tech',
    iconType: 'tech',
    channels: [
      { id: 'general', title: '# General' },
      { id: 'doubt', title: '? Doubt' },
      { id: 'work_job', title: '◦ Work / Job' }
    ],
    feed: {
      title: "Welcome to the Tech Community",
      author: "Alex Rivers",
      role: "Senior Developer",
      descriptionTop: "Explore the latest discussions on software architecture, frontend frameworks, and cloud systems.",
      descriptionBottom: "Join code reviews, share open-source tools, and learn from fellow engineers worldwide.",
      curveColor: "#8cb6fc"
    }
  },
  {
    id: 'marketing',
    name: 'Marketing',
    iconType: 'marketing',
    channels: [
      { id: 'general', title: '# General' },
      { id: 'doubt', title: '? Doubt' },
      { id: 'work_job', title: '◦ Work / Job' }
    ],
    feed: {
      title: "Marketing Strategies & Campaigns",
      author: "Sarah Jenkins",
      role: "Brand Strategist",
      descriptionTop: "Deep dive into performance marketing, SEO, conversion rate optimization, and paid ad copy.",
      descriptionBottom: "Discover high-growth playbooks, brand storytelling, and analytics tracking.",
      curveColor: "#38bdf8"
    }
  },
  {
    id: 'social_media',
    name: 'Social Media',
    iconType: 'social',
    channels: [
      { id: 'general', title: '# General' },
      { id: 'doubt', title: '? Doubt' },
      { id: 'work_job', title: '◦ Work / Job' }
    ],
    feed: {
      title: "Social Media Growth & Trends 2026",
      author: "Elena Rostova",
      role: "Growth Marketer",
      descriptionTop: "Analyzing high-converting content strategies, algorithm updates, and audience engagement tactics.",
      descriptionBottom: "Discuss organic community building, viral video hooks, and multi-platform distribution.",
      curveColor: "#70a1ff"
    }
  },
  {
    id: 'design',
    name: 'Design',
    iconType: 'design',
    channels: [
      { id: 'general', title: '# General' },
      { id: 'doubt', title: '? Doubt' },
      { id: 'work_job', title: '◦ Work / Job' }
    ],
    feed: {
      title: "Welcome to the Design Community",
      author: "Jordan Vance",
      role: "Product Designer",
      descriptionTop: "Mastering micro-interactions, dark mode color science, and component design systems.",
      descriptionBottom: "Share Figma prototypes, critique visual layouts, and refine user experience patterns.",
      curveColor: "#3b82f6"
    }
  },
  {
    id: 'food',
    name: 'Food',
    iconType: 'food',
    channels: [
      { id: 'general', title: '# General' },
      { id: 'doubt', title: '? Doubt' },
      { id: 'work_job', title: '◦ Work / Job' }
    ],
    feed: {
      title: "Artisanal Culinary & Food Culture",
      author: "Chef Marcus",
      role: "Culinary Artist",
      descriptionTop: "Exploring farm-to-table recipes, specialty coffee roast profiles, and global street food.",
      descriptionBottom: "Share kitchen techniques, restaurant reviews, and seasonal menu inspirations.",
      curveColor: "#60a5fa"
    }
  },
  {
    id: 'ai',
    name: 'Artificial Intelligence',
    iconType: 'ai',
    channels: [
      { id: 'general', title: '# General' },
      { id: 'doubt', title: '? Doubt' },
      { id: 'work_job', title: '◦ Work / Job' }
    ],
    feed: {
      title: "AI Breakthroughs & Autonomous Agents",
      author: "Dr. Elena Vance",
      role: "AI Research Scientist",
      descriptionTop: "Discussing LLM architectures, agentic coding workflows, and neural synthesis.",
      descriptionBottom: "Collaborate on foundational model fine-tuning, benchmark evals, and robotics.",
      curveColor: "#6366f1"
    }
  },
  {
    id: 'ml',
    name: 'Machine Learning',
    iconType: 'ml',
    channels: [
      { id: 'general', title: '# General' },
      { id: 'doubt', title: '? Doubt' },
      { id: 'work_job', title: '◦ Work / Job' }
    ],
    feed: {
      title: "ML Engineering & Data Science",
      author: "Siddharth Rao",
      role: "Lead ML Engineer",
      descriptionTop: "Practical pipelines, feature stores, and vector database retrieval architectures.",
      descriptionBottom: "Share Kaggle approaches, PyTorch tricks, and real-world deployment tips.",
      curveColor: "#8b5cf6"
    }
  },
  {
    id: 'cybersecurity',
    name: 'Cybersecurity',
    iconType: 'cybersecurity',
    channels: [
      { id: 'general', title: '# General' },
      { id: 'doubt', title: '? Doubt' },
      { id: 'work_job', title: '◦ Work / Job' }
    ],
    feed: {
      title: "InfoSec, Threat Intel & AppSec",
      author: "Maya Lin",
      role: "Security Researcher",
      descriptionTop: "Zero-day analysis, vulnerability disclosures, and cloud perimeter defense.",
      descriptionBottom: "CTF challenges, cryptography deep dives, and DevSecOps tooling.",
      curveColor: "#ef4444"
    }
  },
  {
    id: 'finance',
    name: 'Finance',
    iconType: 'finance',
    channels: [
      { id: 'general', title: '# General' },
      { id: 'doubt', title: '? Doubt' },
      { id: 'work_job', title: '◦ Work / Job' }
    ],
    feed: {
      title: "Global Markets & Financial Engineering",
      author: "Vikram Malhotra",
      role: "Quantitative Analyst",
      descriptionTop: "Algorithmic trading systems, risk management models, and venture capital trends.",
      descriptionBottom: "Discuss macroeconomic signals, decentralized ledger infrastructure, and valuation.",
      curveColor: "#10b981"
    }
  },
  {
    id: 'business',
    name: 'Business',
    iconType: 'business',
    channels: [
      { id: 'general', title: '# General' },
      { id: 'doubt', title: '? Doubt' },
      { id: 'work_job', title: '◦ Work / Job' }
    ],
    feed: {
      title: "Entrepreneurship & Venture Strategy",
      author: "Claire Sterling",
      role: "Founder & Investor",
      descriptionTop: "Scaling from zero-to-one, building defensible moats, and operational excellence.",
      descriptionBottom: "Pitch deck reviews, founder AMA sessions, and unit economics discussions.",
      curveColor: "#f59e0b"
    }
  },
  {
    id: 'education',
    name: 'Education',
    iconType: 'education',
    channels: [
      { id: 'general', title: '# General' },
      { id: 'doubt', title: '? Doubt' },
      { id: 'work_job', title: '◦ Work / Job' }
    ],
    feed: {
      title: "Higher Ed, Academics & Skill Acquisition",
      author: "Prof. Kenneth Cole",
      role: "Dean of Academic Research",
      descriptionTop: "Pedagogical innovations, academic milestones, and collaborative learning.",
      descriptionBottom: "Share study guides, research grant opportunities, and peer review circles.",
      curveColor: "#0ea5e9"
    }
  },
  {
    id: 'research',
    name: 'Research',
    iconType: 'research',
    channels: [
      { id: 'general', title: '# General' },
      { id: 'doubt', title: '? Doubt' },
      { id: 'work_job', title: '◦ Work / Job' }
    ],
    feed: {
      title: "Frontier Science & Interdisciplinary Studies",
      author: "Dr. Aris Thorne",
      role: "Fellow, SINC Institute",
      descriptionTop: "Preprint discussions, experimental protocols, and reproducible science.",
      descriptionBottom: "Peer feedback, grant applications, and cross-domain collaborations.",
      curveColor: "#ec4899"
    }
  }
];

export const railShortcuts = domains.map(d => ({
  id: d.id,
  label: d.name,
  feedName: `${d.name} Domain`,
  iconType: d.iconType
}));

export const feedPosts = domains.reduce((acc, d) => {
  acc[d.id] = d.feed;
  return acc;
}, {});

export const initialCategories = [
  { id: 'explore', label: 'Explore' },
  { id: 'tech', label: 'Tech' },
  { id: 'travel', label: 'Travel' },
  { id: 'design', label: 'Design', selected: true },
  { id: 'food', label: 'Food' },
  { id: 'more', label: 'More' }
];

// Feed categories for the Home rail — completely independent from user domain memberships.
// 'all' shows every post; any other id filters by the post's `domain` field in Supabase.
export const FEED_CATEGORIES = [
  { id: 'all', name: 'All', iconType: 'all', matchValues: ['all'] },
  { id: 'tech', name: 'Tech', iconType: 'tech', matchValues: ['tech', 'technology'] },
  { id: 'marketing', name: 'Marketing', iconType: 'marketing', matchValues: ['marketing'] },
  { id: 'social_media', name: 'Social Media', iconType: 'social', matchValues: ['social_media', 'social', 'social media'] },
  { id: 'business', name: 'Business', iconType: 'business', matchValues: ['business'] },
  { id: 'design', name: 'Design', iconType: 'design', matchValues: ['design'] },
  { id: 'ai', name: 'AI', iconType: 'ai', matchValues: ['ai', 'artificial intelligence', 'artificial_intelligence'] },
  { id: 'ml', name: 'Machine Learning', iconType: 'ml', matchValues: ['ml', 'machine learning', 'machine_learning'] },
  { id: 'cybersecurity', name: 'Cybersecurity', iconType: 'cybersecurity', matchValues: ['cybersecurity', 'security', 'infosec'] },
  { id: 'finance', name: 'Finance', iconType: 'finance', matchValues: ['finance'] },
  { id: 'food', name: 'Food', iconType: 'food', matchValues: ['food', 'food & lifestyle'] },
  { id: 'education', name: 'Education', iconType: 'education', matchValues: ['education'] },
  { id: 'research', name: 'Research', iconType: 'research', matchValues: ['research'] }
];

/**
 * Robust category matching helper.
 * Returns all potential database values/case variants for a category ID.
 */
export const getCategoryMatchValues = (categoryId) => {
  if (!categoryId || categoryId === 'all') return [];
  const found = FEED_CATEGORIES.find((c) => c.id.toLowerCase() === categoryId.toLowerCase());
  const baseValues = found?.matchValues || [categoryId];
  const variants = new Set();
  baseValues.forEach((v) => {
    variants.add(v.toLowerCase());
    variants.add(v.charAt(0).toUpperCase() + v.slice(1));
    variants.add(v.toUpperCase());
  });
  return Array.from(variants);
};

export const initialDomains = domains.map(d => ({
  id: d.id,
  name: d.name.toUpperCase(),
  iconType: d.iconType,
  isUpper: true
}));

export const initialConversations = [
  { id: '1', name: 'Name', lastMessage: 'Last message preview...', time: '2m' },
  { id: '2', name: 'Name', lastMessage: 'Are you joining the event?', time: '1h' },
  { id: '3', name: 'Name', lastMessage: 'Thanks for the help!', time: '3h' }
];

export const initialDirectMessages = [
  { id: 'm1', text: 'Hi, how are you?', type: 'received' },
  { id: 'm2', text: "I'm good. Thanks!", type: 'sent' },
  { id: 'm3', text: 'Did you check the domain?', type: 'received' }
];

export const users = [
  {
    id: 'u1',
    name: 'Alex Rivers',
    username: 'alexrivers',
    role: 'Senior Developer',
    profession: 'Software Developer',
    bio: 'Passionate about frontend architecture, clean design systems, and cloud scaling.',
    skills: ['React', 'JavaScript', 'Node.js', 'Architecture'],
    domains: ['Tech', 'Design'],
    avatarUrl: null,
    is_verified: true
  },
  {
    id: 'u2',
    name: 'Rahul Sharma',
    username: 'rahul_dev',
    role: 'Software Developer',
    profession: 'Software Developer',
    bio: 'Backend architect focused on Python microservices and PostgreSQL database design.',
    skills: ['Python', 'Django', 'PostgreSQL', 'AWS'],
    domains: ['Tech'],
    avatarUrl: null,
    is_verified: false
  },
  {
    id: 'u3',
    name: 'Maya Patel',
    username: 'mayap',
    role: 'Digital Marketer',
    profession: 'Digital Marketer',
    bio: 'Performance growth marketer crafting viral product copy and SEO engines.',
    skills: ['Growth', 'SEO', 'Content Strategy', 'Copywriting'],
    domains: ['Marketing', 'Social Media'],
    avatarUrl: null,
    is_verified: true
  },
  {
    id: 'u4',
    name: 'Arun Kumar',
    username: 'arunkumar',
    role: 'Frontend Developer',
    profession: 'Software Developer',
    bio: 'Building pixel-perfect user interfaces with React, Tailwind, and WebGL.',
    skills: ['React', 'TypeScript', 'Frontend', 'CSS'],
    domains: ['Tech', 'Design'],
    avatarUrl: null,
    is_verified: false
  },
  {
    id: 'u5',
    name: 'Alex Chen',
    username: 'alexc_design',
    role: 'UI/UX Designer',
    profession: 'Product Designer',
    bio: 'Designing intuitive user journeys, interactive wireframes, and design tokens.',
    skills: ['Figma', 'UI/UX Design', 'Wireframing', 'Prototyping'],
    domains: ['Design'],
    avatarUrl: null,
    is_verified: false
  },
  {
    id: 'u6',
    name: 'Jordan Vance',
    username: 'jordanv',
    role: 'Product Designer',
    profession: 'UI/UX Designer',
    bio: 'Crafting component libraries, micro-interactions, and visual design systems.',
    skills: ['Figma', 'Design Systems', 'Micro-interactions'],
    domains: ['Design', 'Tech'],
    avatarUrl: null,
    is_verified: false
  },
  {
    id: 'u7',
    name: 'Sarah Jenkins',
    username: 'sarahj',
    role: 'Brand Strategist',
    profession: 'Digital Marketer',
    bio: 'Helping startups define brand identity and execute multi-channel campaigns.',
    skills: ['SEO', 'Analytics', 'Conversion Optimization'],
    domains: ['Marketing'],
    avatarUrl: null,
    is_verified: false
  },
  {
    id: 'u8',
    name: 'Elena Rostova',
    username: 'elenar',
    role: 'Growth Marketer',
    profession: 'Digital Marketer',
    bio: 'Scaling organic creator communities and short-form video engagement.',
    skills: ['Viral Video', 'Social Media', 'Community Growth'],
    domains: ['Social Media', 'Marketing'],
    avatarUrl: null,
    is_verified: true
  }
];

export const opportunities = [
  {
    id: 'j1',
    title: 'Senior Frontend Developer',
    role: 'Software Developer',
    position: 'Senior Developer',
    domainId: 'tech',
    domainName: 'Tech',
    company: 'SINC Core Tech',
    location: 'Remote',
    type: 'Full-time',
    description: 'Lead frontend development of modern web applications with React, custom CSS systems, and performance optimization.',
    skills: ['React', 'JavaScript', 'CSS', 'State Management'],
    requirements: [
      '5+ years experience building modern web interfaces',
      'Deep knowledge of React, JavaScript ES6+, and CSS',
      'Experience with scalable component architecture'
    ]
  },
  {
    id: 'j2',
    title: 'UI/UX Designer',
    role: 'UI/UX Designer',
    position: 'Product Designer',
    domainId: 'design',
    domainName: 'Design',
    company: 'Pixel Craft Studios',
    location: 'Hybrid',
    type: 'Full-time',
    description: 'Design intuitive component libraries, interactive user flows, and aesthetic prototypes for social collaboration tools.',
    skills: ['Figma', 'UI/UX', 'Design Systems', 'Prototyping'],
    requirements: [
      'Strong portfolio showcasing mobile & web product design',
      'Proficiency in Figma and component design systems',
      'Ability to collaborate closely with frontend engineers'
    ]
  },
  {
    id: 'j3',
    title: 'Digital Marketer',
    role: 'Digital Marketer',
    position: 'Growth Lead',
    domainId: 'marketing',
    domainName: 'Marketing',
    company: 'Growth Engine Co',
    location: 'Remote',
    type: 'Contract',
    description: 'Drive high-converting acquisition campaigns, performance marketing funnels, and search engine optimization.',
    skills: ['Growth Marketing', 'SEO', 'Copywriting', 'Analytics'],
    requirements: [
      'Proven track record in organic growth and paid ad ROI',
      'Expertise in keyword research and conversion funnels',
      'Strong analytical mindset and metric reporting'
    ]
  },
  {
    id: 'j4',
    title: 'Software Developer (Backend)',
    role: 'Software Developer',
    position: 'Backend Developer',
    domainId: 'tech',
    domainName: 'Tech',
    company: 'DataStream Systems',
    location: 'On-site',
    type: 'Full-time',
    description: 'Architect scalable real-time microservices, RESTful APIs, and cloud database infrastructure.',
    skills: ['Python', 'Node.js', 'PostgreSQL', 'REST APIs'],
    requirements: [
      '3+ years experience with backend web development',
      'Solid experience with relational databases and API design',
      'Familiarity with containerization and cloud infrastructure'
    ]
  },
  {
    id: 'j5',
    title: 'Data Analyst',
    role: 'Data Analyst',
    position: 'BI Specialist',
    domainId: 'tech',
    domainName: 'Tech',
    company: 'Insights Lab',
    location: 'Remote',
    type: 'Full-time',
    description: 'Analyze user behavior data, build operational dashboards, and present key product metrics to stakeholders.',
    skills: ['SQL', 'Python', 'Data Analytics', 'Dashboards'],
    requirements: [
      'Strong SQL querying skills and statistical analysis',
      'Experience building dashboards and visualization tools',
      'Keen attention to data accuracy and trend reporting'
    ]
  },
  {
    id: 'j6',
    title: 'Content & Social Media Manager',
    role: 'Digital Marketer',
    position: 'Social Media Specialist',
    domainId: 'social_media',
    domainName: 'Social Media',
    company: 'Viral Pulse Agency',
    location: 'Remote',
    type: 'Part-time',
    description: 'Manage cross-platform content schedules, community interaction, and short-form video creative strategy.',
    skills: ['Social Media', 'Content Creation', 'Community', 'Video Editing'],
    requirements: [
      'Experience managing tech or design social channels',
      'Creative copywriter with an eye for video hooks',
      'Passionate about community engagement and trends'
    ]
  }
];

