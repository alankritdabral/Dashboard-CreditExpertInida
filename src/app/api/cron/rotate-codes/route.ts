import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

// Generate a random 6-character alphanumeric code
const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export async function GET(request: Request) {
  // Simple protection via auth header
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const branches = ['rudrapur', 'delhi', 'dehradun'];
    const batch = adminDb.batch();

    const newCodes: Record<string, string> = {};

    branches.forEach((branch) => {
      const code = generateCode();
      newCodes[branch] = code;
      const docRef = adminDb.collection('access_code_creditexpert').doc(branch);
      batch.set(docRef, {
        code,
        updatedAt: new Date()
      }, { merge: true });
    });

    await batch.commit();

    return NextResponse.json({ success: true, updated: newCodes });
  } catch (error: any) {
    console.error('Error rotating codes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
