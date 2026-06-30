/**
 * S3-4 — Authoring Engine API Integration Test
 *
 * qi-resolve → draft-generate → draft-validate → draft-publish の
 * チェーンが成立することを確認する。
 *
 * 既存の重要Entityを汚さないよう、専用のテストEntity（test-s34-draftchain）に対して
 * 実行する。Coverage Gate を通すための adoptedEvidence はリクエストに直接含め、
 * evidence:{slug} KV は使わない（KV汚染を最小化する）。
 *
 * 使い方:
 *   BASE_URL=https://app.aisle-aio.ai node scripts/verify-s3-4-draft-chain.mjs
 *
 * デプロイ前提:
 *   qi-resolve / draft-generate / draft-validate / draft-publish が
 *   BASE_URL 上にデプロイ済みであること。
 *
 * 後始末:
 *   本スクリプトが作成した Reference は questionSlug を標準出力に表示する。
 *   不要な場合は既存の /api/page-delete（{ clientSlug: 'test-s34-draftchain',
 *   questionSlug, deleteFromIndex: true }）で削除すること。
 */

const BASE_URL = process.env.BASE_URL || 'https://app.aisle-aio.ai';
const TEST_SLUG = 'test-s34-draftchain';
const TEST_COMPANY_NAME = 'S3-4 Integration Test Entity';
const TEST_PRODUCT_CATEGORY = 'Internal QA / Authoring Engine Test';
const TARGET_PROMPT_TYPE_ID = 'P-01'; // requiredCoverage: [Capability] のみ → 最小Evidenceで UNLOCKED にしやすい

// P-01 の responseSchema（refbase:registry:responseSchemas 登録値と同一。S3-2 draft-validate へ渡す）
const P01_RESPONSE_SCHEMA = {
  promptTypeId: 'P-01',
  sections: [
    { sectionId: 'summary', label: '概要', required: true },
    { sectionId: 'capabilities', label: '主な特徴・強み', required: true },
    { sectionId: 'usecases', label: '活用シーン', required: false },
  ],
  citationRequired: false,
};

// Coverage Gate を UNLOCKED にするための最小 Evidence（KVには保存しない。リクエストで直接渡す）
const TEST_EVIDENCE = [
  {
    type: 'feature',
    title: 'S3-4テスト用ダミー機能',
    description: 'Authoring Engine API チェーン検証用の合成Evidence。本番データではない。',
    entityRole: 'primary',
    tags: ['test'],
    confidence: 'high',
    needsVerification: false,
    coverageType: ['Capability', 'Identity'],
  },
];

let pass = 0;
let fail = 0;
function check(label, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function postJson(path, body) {
  const resp = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await resp.json(); } catch { /* noop */ }
  return { status: resp.status, json };
}

async function main() {
  console.log(`\n=== S3-4 Authoring Engine API Integration Test ===`);
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`Test Entity: ${TEST_SLUG}`);
  console.log(`Target P-ID: ${TARGET_PROMPT_TYPE_ID}\n`);

  // ── Step 1: qi-resolve ──────────────────────────────────────────────────
  console.log('--- Step 1: /api/qi-resolve ---');
  const qiRes = await postJson('/api/qi-resolve', {
    clientSlug: TEST_SLUG,
    companyName: TEST_COMPANY_NAME,
    perPID: [{ promptTypeId: TARGET_PROMPT_TYPE_ID, promptText: '' }],
    targetPromptTypeIds: [TARGET_PROMPT_TYPE_ID],
    adoptedEvidence: TEST_EVIDENCE,
  });
  check('HTTP 200', qiRes.status === 200, `status=${qiRes.status} body=${JSON.stringify(qiRes.json)}`);
  check('ok=true', qiRes.json?.ok === true);
  check('instances[] に1件以上', Array.isArray(qiRes.json?.instances) && qiRes.json.instances.length > 0);
  const instance = qiRes.json?.instances?.find(i => i.promptTypeId === TARGET_PROMPT_TYPE_ID);
  check(`promptTypeId=${TARGET_PROMPT_TYPE_ID} の instance が UNLOCKED で返る`, !!instance, JSON.stringify(qiRes.json?.coverageGate));
  if (!instance) {
    console.log('\n[ABORT] Question Instance が解決できなかったため、以降のテストをスキップします。');
    printSummary();
    return;
  }
  console.log(`  instanceId=${instance.instanceId}`);
  console.log(`  resolvedText="${instance.resolvedText}"`);

  // ── Step 2: draft-generate ───────────────────────────────────────────────
  console.log('\n--- Step 2: /api/draft-generate ---');
  const draftRes = await postJson('/api/draft-generate', {
    instanceId: instance.instanceId,
    clientSlug: TEST_SLUG,
    companyName: TEST_COMPANY_NAME,
    productCategory: TEST_PRODUCT_CATEGORY,
    promptTypeId: TARGET_PROMPT_TYPE_ID,
    promptText: instance.resolvedText,
    adoptedEvidence: TEST_EVIDENCE,
    attemptNumber: 1,
  });
  check('HTTP 200', draftRes.status === 200, `status=${draftRes.status} body=${JSON.stringify(draftRes.json)}`);
  check('ok=true', draftRes.json?.ok === true);
  const draft = draftRes.json?.draft;
  check('draft が返る（draftId / narrative あり）', !!draft?.draftId && !!draft?.narrative?.answer);
  if (!draft) {
    console.log('\n[ABORT] Draft が生成できなかったため、以降のテストをスキップします。');
    printSummary();
    return;
  }
  check('draft.instanceId が一致する', draft.instanceId === instance.instanceId);
  check('draft.generator.attemptNumber === 1', draft.generator?.attemptNumber === 1);
  console.log(`  draftId=${draft.draftId}`);
  console.log(`  answer="${draft.narrative.answer.slice(0, 60)}..."`);

  // ── Step 3: draft-validate（正常系） ─────────────────────────────────────
  console.log('\n--- Step 3: /api/draft-validate ---');
  const validateRes = await postJson('/api/draft-validate', {
    draft,
    responseSchema: P01_RESPONSE_SCHEMA,
    requiredCoverage: ['Capability'],
  });
  check('HTTP 200', validateRes.status === 200, `status=${validateRes.status} body=${JSON.stringify(validateRes.json)}`);
  check('ok=true', validateRes.json?.ok === true);
  const validatedDraft = validateRes.json?.validatedDraft;
  check('validatedDraft が返る', !!validatedDraft);
  if (!validatedDraft) {
    console.log('\n[ABORT] ValidatedDraft が生成できなかったため、以降のテストをスキップします。');
    printSummary();
    return;
  }
  check('validatedDraft.draftId が一致する', validatedDraft.draftId === draft.draftId);
  check(
    'validatedDraft.ok===true（schema/citation/coverage すべてOK）',
    validatedDraft.ok === true,
    JSON.stringify(validatedDraft.issues),
  );
  console.log(`  schemaCheck.ok=${validatedDraft.schemaCheck?.ok} citationCheck.ok=${validatedDraft.citationCheck?.ok} coverageCheck.ok=${validatedDraft.coverageCheck?.ok}`);

  // ── Step 4-A: draft-publish 失敗系（ok=false） ───────────────────────────
  console.log('\n--- Step 4-A: /api/draft-publish（失敗系: validatedDraft.ok=false） ---');
  const fakeNgValidated = { ...validatedDraft, ok: false };
  const publishNg1 = await postJson('/api/draft-publish', {
    draft,
    validatedDraft: fakeNgValidated,
    companyName: TEST_COMPANY_NAME,
    productCategory: TEST_PRODUCT_CATEGORY,
  });
  check('HTTP 400', publishNg1.status === 400, `status=${publishNg1.status}`);
  check('ok=false でPublishされない', publishNg1.json?.ok === false && !publishNg1.json?.reference);

  // ── Step 4-B: draft-publish 失敗系（draftId不一致） ──────────────────────
  console.log('\n--- Step 4-B: /api/draft-publish（失敗系: draftId不一致） ---');
  const fakeMismatch = { ...validatedDraft, draftId: 'not-a-real-draft-id' };
  const publishNg2 = await postJson('/api/draft-publish', {
    draft,
    validatedDraft: fakeMismatch,
    companyName: TEST_COMPANY_NAME,
    productCategory: TEST_PRODUCT_CATEGORY,
  });
  check('HTTP 400', publishNg2.status === 400, `status=${publishNg2.status}`);
  check('draftId不一致でPublishされない', publishNg2.json?.ok === false && !publishNg2.json?.reference);

  // ── Step 4-C: draft-publish 正常系 ────────────────────────────────────────
  console.log('\n--- Step 4-C: /api/draft-publish（正常系） ---');
  const publishOk = await postJson('/api/draft-publish', {
    draft,
    validatedDraft,
    companyName: TEST_COMPANY_NAME,
    productCategory: TEST_PRODUCT_CATEGORY,
  });
  check('HTTP 200', publishOk.status === 200, `status=${publishOk.status} body=${JSON.stringify(publishOk.json)}`);
  check('ok=true', publishOk.json?.ok === true);
  check('questionSlug が返る', !!publishOk.json?.questionSlug);
  check('refbaseUrl が返る', !!publishOk.json?.refbaseUrl);
  check('reference.instanceId / draftId が記録されている',
    publishOk.json?.reference?.instanceId === instance.instanceId &&
    publishOk.json?.reference?.draftId === draft.draftId);

  console.log(`\n  questionSlug=${publishOk.json?.questionSlug}`);
  console.log(`  refbaseUrl=${publishOk.json?.refbaseUrl}`);
  console.log(`  studioUrl=${publishOk.json?.studioUrl}`);

  // ── Step 5: RefBase KV確認（refbase-get.ts 経由） ─────────────────────────
  if (publishOk.json?.questionSlug) {
    console.log('\n--- Step 5: RefBase KV 反映確認（/api/refbase-get） ---');
    const refbaseCheck = await fetch(`${BASE_URL}/api/refbase-get?clientSlug=${TEST_SLUG}`);
    const refbaseJson = await refbaseCheck.json().catch(() => null);
    check('refbase-get で Entity が取得できる', refbaseCheck.ok && !!refbaseJson);
    console.log(`  refbase-get status=${refbaseCheck.status}`);
  }

  console.log(`\n=== 後始末 ===`);
  console.log(`テストEntity: ${TEST_SLUG}`);
  console.log(`作成 questionSlug: ${publishOk.json?.questionSlug ?? '(未作成)'}`);
  console.log(`削除する場合: POST /api/page-delete { clientSlug: '${TEST_SLUG}', questionSlug: '${publishOk.json?.questionSlug}', deleteFromIndex: true }`);

  printSummary();
}

function printSummary() {
  console.log(`\n=== Summary: ${pass} PASS / ${fail} FAIL ===\n`);
  if (fail > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exitCode = 1;
});
