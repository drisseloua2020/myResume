import { API_URL } from "./apiClient";

const OAUTH_CALLBACK_PATH_RE = /^\/auth\/oauth\/([^/]+)\/callback\/?$/;

type BrowserLocation = Pick<Location, "origin" | "pathname" | "search">;

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function isOAuthCallbackPath(pathname: string): boolean {
  return OAUTH_CALLBACK_PATH_RE.test(pathname);
}

export function getOAuthBackendCallbackRedirect(
  location: BrowserLocation,
  apiUrl: string = API_URL,
): string | null {
  const match = location.pathname.match(OAUTH_CALLBACK_PATH_RE);
  if (!match) return null;

  const params = new URLSearchParams(location.search);
  if (params.has("token")) return null;
  if (!params.has("state")) return null;
  if (!params.has("code") && !params.has("error")) return null;

  const provider = match[1].toLowerCase();
  let redirectUrl: URL;
  try {
    redirectUrl = new URL(`/auth/oauth/${encodeURIComponent(provider)}/callback`, apiUrl);
  } catch {
    return null;
  }
  redirectUrl.search = params.toString();

  const sameOrigin = redirectUrl.origin === location.origin;
  const samePath = withoutTrailingSlash(redirectUrl.pathname) === withoutTrailingSlash(location.pathname);
  if (sameOrigin && samePath) return null;

  return redirectUrl.toString();
}
