/**
 * Aisle Monitor（M2 UI）共通 fetch ラッパー。
 *
 * 6 API（monitor-entities / monitor-contact / monitor-appearance /
 * monitor-crawl-log / monitor-dashboard）はすべて isAuthorized() ガード
 * （x-aisle-admin: 1 ヘッダー）を要求する。monitor-crawl-ingest はRefBase側からの
 * サーバー間連携専用（MONITOR_INGEST_SECRET認証）でありUIからは呼ばない。
 *
 * src/lib/authoringApi.ts と同方針。GET/POST両対応にした点のみ異なる。
 */

export class MonitorApiError extends Error {
  status: number;
  isAuthError: boolean;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'MonitorApiError';
    this.status = status;
    this.isAuthError = status === 401;
  }
}

async function handleResponse<TResponse extends { ok: boolean; error?: string }>(resp: Response): Promise<TResponse> {
  if (resp.status === 401) {
    throw new MonitorApiError(401, '認証エラー：管理者に確認してください');
  }

  let json: TResponse;
  try {
    json = await resp.json() as TResponse;
  } catch {
    throw new MonitorApiError(resp.status, `レスポンスの解析に失敗しました（HTTP ${resp.status}）`);
  }

  if (!resp.ok || json.ok === false) {
    throw new MonitorApiError(resp.status, json.error ?? `APIエラー（HTTP ${resp.status}）`);
  }

  return json;
}

export async function monitorGet<TResponse extends { ok: boolean; error?: string }>(
  path: string,
): Promise<TResponse> {
  let resp: Response;
  try {
    resp = await fetch(path, { headers: { 'x-aisle-admin': '1' } });
  } catch {
    throw new MonitorApiError(0, 'ネットワークエラーが発生しました');
  }
  return handleResponse<TResponse>(resp);
}

export async function monitorPost<TResponse extends { ok: boolean; error?: string }>(
  path: string,
  body: unknown,
): Promise<TResponse> {
  let resp: Response;
  try {
    resp = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-aisle-admin': '1' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new MonitorApiError(0, 'ネットワークエラーが発生しました');
  }
  return handleResponse<TResponse>(resp);
}
