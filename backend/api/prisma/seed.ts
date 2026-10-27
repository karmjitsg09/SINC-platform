/**
 * SINC Backend — Local Development Database Seed Script
 *
 * CRITICAL SAFETY INTERLOCK:
 * This script is strictly restricted to LOCAL development environments.
 * It enforces multiple fail-closed guards to refuse execution against non-local
 * or production databases.
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Allowed hostnames for local seeding
const ALLOWED_LOCAL_HOSTS = ['localhost', '127.0.0.1', 'sinc-postgres', 'host.docker.internal'];

function enforceLocalOnlyGuard(): void {
  const dbUrl = process.env.DATABASE_URL || '';
  const directUrl = process.env.DIRECT_URL || '';
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (nodeEnv === 'production') {
    console.error('FATAL SAFETY VIOLATION: Cannot run seed script in production environment.');
    process.exit(1);
  }

  // Check forbidden production/staging host signatures
  const forbiddenPatterns = ['supabase.co', 'supabase.com', 'aws-', 'pooler.supabase', 'render.com', 'railway.app'];
  for (const pattern of forbiddenPatterns) {
    if (dbUrl.includes(pattern) || directUrl.includes(pattern)) {
      console.error(`FATAL SAFETY VIOLATION: Seed script detected non-local host pattern "${pattern}". Aborting.`);
      process.exit(1);
    }
  }

  // Verify host is explicitly local
  let isLocal = false;
  for (const localHost of ALLOWED_LOCAL_HOSTS) {
    if (dbUrl.includes(localHost) || directUrl.includes(localHost)) {
      isLocal = true;
      break;
    }
  }

  if (!isLocal) {
    console.error('FATAL SAFETY VIOLATION: DATABASE_URL does not resolve to an approved local host (localhost, 127.0.0.1, sinc-postgres).');
    process.exit(1);
  }

  console.log('[Seed Guard] Confirmed local environment. Proceeding with fake local seed data...');
}

async function main() {
  enforceLocalOnlyGuard();

  console.log('Seeding fake local developer profiles...');

  // Fake Profile 1 (Alice)
  const aliceId = '00000000-0000-0000-0000-000000000001';
  const alice = await prisma.profiles.upsert({
    where: { username: 'local_alice' },
    update: {},
    create: {
      id: aliceId,
      name: 'Local Alice (Demo)',
      username: 'local_alice',
      role: 'Full Stack Engineer',
      bio: 'Fake local test account for development only.',
      skills: ['TypeScript', 'NestJS', 'React', 'PostgreSQL'],
      domains: ['tech']
    }
  });

  // Fake Profile 2 (Bob)
  const bobId = '00000000-0000-0000-0000-000000000002';
  const bob = await prisma.profiles.upsert({
    where: { username: 'local_bob' },
    update: {},
    create: {
      id: bobId,
      name: 'Local Bob (Demo)',
      username: 'local_bob',
      role: 'Product Designer',
      bio: 'Fake local UI/UX designer account for testing interactions.',
      skills: ['Figma', 'UI Design', 'Design Systems'],
      domains: ['design', 'tech']
    }
  });

  // Fake Follow Relationship: Alice -> Bob (Accepted)
  await prisma.follow_requests.upsert({
    where: {
      follower_user_id_following_user_id: {
        follower_user_id: alice.id,
        following_user_id: bob.id
      }
    },
    update: {},
    create: {
      follower_user_id: alice.id,
      following_user_id: bob.id,
      status: 'accepted'
    }
  });

  // Fake Post by Alice
  const post = await prisma.posts.create({
    data: {
      user_id: alice.id,
      content: 'Welcome to local SINC NestJS backend! This is a fake local post for testing.',
      domain: 'tech',
      post_type: 'text'
    }
  });

  // Fake Like by Bob
  await prisma.post_likes.create({
    data: {
      post_id: post.id,
      user_id: bob.id
    }
  });

  // Fake Comment by Bob
  await prisma.post_comments.create({
    data: {
      post_id: post.id,
      user_id: bob.id,
      content: 'Local test comment: NestJS API architecture working cleanly!'
    }
  });

  console.log('Local fake seed completed successfully:');
  console.log(`- Created local users: ${alice.username}, ${bob.username}`);
  console.log(`- Created local test post: ${post.id}`);
}

main()
  .catch((e) => {
    console.error('Seed execution error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
