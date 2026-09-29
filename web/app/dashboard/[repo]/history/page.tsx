import { createClient } from '@/lib/supabase/server';
import { getHistory } from '@/lib/hindsight-client';
import HistoryClient from './HistoryClient';

export const metadata = {
  title: 'SecurePush | History',
};

export default async function RepoHistoryPage(props: { params: Promise<{ repo: string }> }) {
  const { repo } = await props.params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div style={{ padding: '32px', color: 'var(--text-muted)' }}>Not authenticated</div>;
  }

  const bank_id = `securepush-${user.user_metadata.user_name || user.id}-${repo}`;
  const { data: repoData } = await supabase
    .from('repos')
    .select('id, last_scan_at, attestation_tx_id')
    .eq('bank_id', bank_id)
    .single();

  let stats = null;
  if (repoData?.id) {
    const { data: s } = await supabase
      .from('repo_stats')
      .select('*')
      .eq('repo_id', repoData.id)
      .single();
    stats = s;
  }

  // Fetch real scan history from Hindsight bank
  // Do NOT fall back to fake prototype data
  const history = await getHistory(bank_id);

  return <HistoryClient repo={repo} repoData={repoData} stats={stats} history={history} />;
}
