import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { attestScan } from '@/lib/contracts/attest';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { 
      bank_id, 
      repo_name, 
      branch = 'main',
      provider = 'groq',
      model,
      test_command,
      thresholds = { escalation_quality: 0.7, file_shrink_max_pct: 30 },
      findings = [],
      muted = [],
      blocked = false,
      commit_sha, // Optional, preserved for backward compat with attestation
      recalled_memories = [],
      memory_updated = false
    } = payload;

    if (!bank_id || !repo_name) {
      return NextResponse.json({ error: 'Missing required fields: bank_id, repo_name' }, { status: 400 });
    }

    const supabaseAdmin = require('@supabase/supabase-js').createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Look up owner_id from profiles by matching bank_id's embedded github_username
    // bank_id format: "securepush-{github_username}-{repo_name}"
    const usernameMatch = bank_id.match(/^securepush-([^-]+)-/);
    if (!usernameMatch) {
      return NextResponse.json({ error: 'Invalid bank_id format' }, { status: 400 });
    }
    const github_username = usernameMatch[1];
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('github_username', github_username)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found for bank_id' }, { status: 404 });
    }
    
    const owner_id = profile.id;

    const mergedThresholds = {
      ...(typeof thresholds === 'object' && thresholds !== null ? thresholds : {}),
      latest_recall: Array.isArray(recalled_memories) ? recalled_memories : [],
      memory_updated: Boolean(memory_updated),
      recalled_at: new Date().toISOString()
    };

    // 2. Upsert repos config
    const { data: repo, error: dbError } = await supabaseAdmin
      .from('repos')
      .upsert({
        owner_id,
        name: repo_name,
        bank_id,
        branch,
        provider,
        model,
        test_command,
        thresholds: mergedThresholds,
        last_scan_at: new Date().toISOString()
      }, { onConflict: 'owner_id, name' })
      .select('id')
      .single();

    if (dbError || !repo) {
      console.error('Failed to upsert repo config', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // 3. Update repo_stats using atomic RPC
    let secretsCaught = 0;
    let vulnsCaught = 0;
    let hallucinatedDepsCaught = 0;
    
    for (const finding of findings) {
      // Assuming 'fixed' or 'rejected' counts as a finding. 
      // Actually, caught means the scanner found it, regardless of action.
      if (finding.issue === 'hardcoded_secret') secretsCaught++;
      else if (finding.issue === 'hallucinated_dependency') hallucinatedDepsCaught++;
      else vulnsCaught++; // Defaulting others to vulns for simple stats
    }

    const pushesBlocked = blocked ? 1 : 0;
    const pushesAllowed = blocked ? 0 : 1;

    const { error: statsError } = await supabaseAdmin.rpc('increment_repo_stats', {
      p_repo_id: repo.id,
      p_total_scans: 1,
      p_secrets_caught: secretsCaught,
      p_vulns_caught: vulnsCaught,
      p_hallucinated_deps_caught: hallucinatedDepsCaught,
      p_pushes_blocked: pushesBlocked,
      p_pushes_allowed: pushesAllowed
    });

    if (statsError) {
      console.error('Failed to increment repo stats', statsError);
    }

    // 4. Upsert muted_rules
    if (muted && muted.length > 0) {
      for (const issue of muted) {
        const { error: muteError } = await supabaseAdmin
          .from('muted_rules')
          .upsert({ repo_id: repo.id, issue_type: issue }, { onConflict: 'repo_id, issue_type' });
        
        if (muteError) {
          console.error(`Failed to upsert muted rule: ${issue}`, muteError);
        }
      }
    }

    // 5. On-Chain Attestation (if commit_sha is provided)
    let scanHash = null;
    if (commit_sha) {
      const timestamp = Date.now().toString();
      const passed = !blocked;
      const rawData = `${bank_id}-${commit_sha}-${passed}-${timestamp}`;
      scanHash = crypto.createHash('sha256').update(rawData).digest('hex');

      // Do not block or fail main response
      attestScan(scanHash, passed)
        .then(async (txId) => {
          console.log(`Scan attested on-chain with TxID: ${txId}`);
          await supabaseAdmin
            .from('repos')
            .update({ attestation_tx_id: txId })
            .eq('id', repo.id);
        })
        .catch((err) => {
          console.error('Failed to attest scan on-chain:', err);
        });
    }

    return NextResponse.json({ success: true, scanHash });
  } catch (err: any) {
    console.error('Scan complete error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
