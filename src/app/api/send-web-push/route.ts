import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAuth } from '@/lib/serverAuth';
const { sendPushNotification } = require('../../../lib/serverPushDispatcher.cjs');

export async function POST(req: NextRequest) {
  try {
    // 1. Verify caller authentication
    const auth = verifyServerAuth(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // 2. Parse and validate payload
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    }

    const { recipientId, type, title, message, url, entityType, entityId } = body;

    if (!recipientId || typeof recipientId !== 'string' || recipientId.trim() === '') {
      return NextResponse.json({ error: 'Missing or invalid recipientId' }, { status: 400 });
    }

    // 3. Dispatch push notification with authoritatively bound callerId
    const result = await sendPushNotification({
      callerId: auth.userId,
      authToken: auth.token,
      recipientId: recipientId.trim(),
      type: type || 'notification',
      title: title || 'SINC Notification',
      message: message || 'You have a new update on SINC.',
      url: url || '/notifications',
      entityType,
      entityId
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Web push dispatch failure' }, { status: 500 });
  }
}
