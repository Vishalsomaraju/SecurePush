import { createClient } from '@/lib/supabase/server';
import { getSecurityMemories } from '@/lib/hindsight-client';
import MemoryClient from './MemoryClient';

export const metadata = {
  title: 'SecurePush | Memory',
};

export default async function RepoMemoryPage(props: { params: Promise<{ repo: string }> }) {
  const { repo } = await props.params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div style={{ padding: '32px', color: 'var(--text-muted)' }}>Not authenticated</div>;
  }

  const bank_id = `securepush-${user.user_metadata.user_name || user.id}-${repo}`;

  const { data: repoData } = await supabase
    .from('repos')
    .select('last_scan_at, thresholds')
    .eq('bank_id', bank_id)
    .single();

  const memoryResult = await getSecurityMemories(bank_id);

  const latestRecall = Array.isArray(repoData?.thresholds?.latest_recall)
    ? repoData.thresholds.latest_recall
    : [];
  const memoryUpdated = Boolean(repoData?.thresholds?.memory_updated);
  const recalledAt = repoData?.thresholds?.recalled_at;

  return (
    <MemoryClient
      repo={repo}
      bankId={bank_id}
      memoryResult={memoryResult}
      latestRecall={latestRecall}
      memoryUpdated={memoryUpdated}
      recalledAt={recalledAt}
      lastScanAt={repoData?.last_scan_at}
    />
  );
}
