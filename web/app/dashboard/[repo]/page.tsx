import { createClient } from '@/lib/supabase/server';
import { getSecurityMemories } from '@/lib/hindsight-client';
import OverviewClient from './OverviewClient';

export const metadata = {
  title: 'SecurePush | Overview',
};

export default async function RepoOverviewPage(props: { params: Promise<{ repo: string }> }) {
  const { repo } = await props.params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const bank_id = user ? `securepush-${user.user_metadata.user_name || user.id}-${repo}` : '';

  let repoData = null;
  let memoryData = null;
  let stats = null;

  if (bank_id) {
    const { data: rData } = await supabase
      .from('repos')
      .select('id, last_scan_at, thresholds')
      .eq('bank_id', bank_id)
      .single();
    repoData = rData;

    if (rData?.id) {
      const { data: sData } = await supabase
        .from('repo_stats')
        .select('*')
        .eq('repo_id', rData.id)
        .single();
      stats = sData;
    }

    memoryData = await getSecurityMemories(bank_id);
  }

  const latestRecall = Array.isArray(repoData?.thresholds?.latest_recall)
    ? repoData.thresholds.latest_recall
    : [];

  return (
    <OverviewClient
      repo={repo}
      bankId={bank_id}
      repoData={repoData}
      stats={stats}
      memoryData={memoryData}
      latestRecallCount={latestRecall.length}
    />
  );
}
