/**
 * Authoring Workbench（S4）共通 fetch ラッパー。
 *
 * 4 API（qi-resolve / draft-generate / draft-validate / draft-publish）は
 * すべて isAuthorized() ガード（x-aisle-admin: 1 ヘッダー）を要求する。
 * ここで一元的にヘッダーを付与し、401 を AuthoringApiError として判別可能にする。
 *
 * 将来的な置き換え予定（Parking Lot）:
 *   x-aisle-admin ヘッダーはブラウザの開発者ツールから読み取り可能な簡易ガードであり、
 *   正式な認証方式（セッショントークン等）への置き換えを前提とする。
 *   現時点では Studio 全体が PasswordGate 配下にあることを前提に許容する。
 */

export class AuthoringApiError extends Error {
  status: number;
  isAuthError: boolean;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AuthoringApiError';
    this.status = status;
    this.isAuthError = status === 401;
  }
}

export async function authoringFetch<TResponse extends { ok: boolean; error?: string }>(
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
    throw new AuthoringApiError(0, 'ネットワークエラーが発生しました');
  }

  if (resp.status === 401) {
    throw new AuthoringApiError(401, '認証エラー：管理者に確認してください');
  }

  let json: TResponse;
  try {
    json = await resp.json() as TResponse;
  } catch {
    throw new AuthoringApiError(resp.status, `レスポンスの解析に失敗しました（HTTP ${resp.status}）`);
  }

  if (!resp.ok || json.ok === false) {
    throw new AuthoringApiError(resp.status, json.error ?? `APIエラー（HTTP ${resp.status}）`);
  }

  return json;
}
