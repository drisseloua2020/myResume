import { describe, expect, it } from "vitest";
import { getOAuthBackendCallbackRedirect, isOAuthCallbackPath } from "./oauthRedirect";

describe("oauthRedirect", () => {
  it("forwards a frontend OAuth callback to the configured API callback", () => {
    const redirect = getOAuthBackendCallbackRedirect(
      {
        origin: "https://myresume-rrcy.onrender.com",
        pathname: "/auth/oauth/google/callback",
        search: "?code=provider-code&state=signed-state&scope=email",
      } as Location,
      "https://myresume-api.onrender.com",
    );

    expect(redirect).toBe(
      "https://myresume-api.onrender.com/auth/oauth/google/callback?code=provider-code&state=signed-state&scope=email",
    );
  });

  it("does not forward backend token redirects that already completed login", () => {
    const redirect = getOAuthBackendCallbackRedirect(
      {
        origin: "https://myresume-rrcy.onrender.com",
        pathname: "/auth/oauth/google/callback",
        search: "?token=app-token&templateId=classic_pro",
      } as Location,
      "https://myresume-api.onrender.com",
    );

    expect(redirect).toBeNull();
  });

  it("does not loop when the callback is already on the API origin", () => {
    const redirect = getOAuthBackendCallbackRedirect(
      {
        origin: "https://myresume-api.onrender.com",
        pathname: "/auth/oauth/google/callback",
        search: "?code=provider-code&state=signed-state",
      } as Location,
      "https://myresume-api.onrender.com",
    );

    expect(redirect).toBeNull();
  });

  it("recognizes OAuth callback paths", () => {
    expect(isOAuthCallbackPath("/auth/oauth/google/callback")).toBe(true);
    expect(isOAuthCallbackPath("/auth/login")).toBe(false);
  });
});
