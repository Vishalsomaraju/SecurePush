import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { keyName, apiKey, provider } = await req.json();
  if (!apiKey || !provider) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  // Fetch current settings
  const { data: profile } = await supabase
    .from('profiles')
    .select('settings')
    .eq('id', session.user.id)
    .single();

  const currentSettings = profile?.settings || {};
  
  const updatedSettings = {
    ...currentSettings,
    byo_key: {
      name: keyName || 'My Key',
      key: apiKey,
      provider: provider
    }
  };

  const { error } = await supabase
    .from('profiles')
    .update({ settings: updatedSettings })
    .eq('id', session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
