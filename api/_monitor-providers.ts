/**
 * Aisle Monitor Provider定義 — M1
 *
 * M1時点ではProviderはKV Registry化せず、コード内定数として持つ
 * （3種のみで変更頻度が低いため。Studioの`refbase:registry:*`のような
 * Registry化が必要になった場合はM2以降で再検討する）。
 */

import type { MonitorProviderDef } from './_monitor-types.js';

export const MONITOR_PROVIDERS: MonitorProviderDef[] = [
  {
    providerId: 'chatgpt',
    displayName: 'ChatGPT',
    contactApiAvailable: false,   // M1時点では未実装（要API仕様検証）
    monitoringApiAvailable: false,
    botUserAgentPatterns: ['GPTBot', 'ChatGPT-User', 'OAI-SearchBot'],
  },
  {
    providerId: 'perplexity',
    displayName: 'Perplexity',
    contactApiAvailable: false,
    monitoringApiAvailable: false,
    botUserAgentPatterns: ['PerplexityBot', 'Perplexity-User'],
  },
  {
    providerId: 'gemini',
    displayName: 'Gemini',
    contactApiAvailable: false,
    monitoringApiAvailable: false,
    botUserAgentPatterns: ['Google-Extended', 'Googlebot'],
  },
];
