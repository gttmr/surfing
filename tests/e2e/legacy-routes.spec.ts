import { expect, test } from "@playwright/test";

test("removed compatibility APIs stay unavailable", async ({ request }) => {
  const removedRoutes = [
    ["GET", "/api/members"],
    ["GET", "/api/companions/unlinked"],
    ["POST", "/api/companions/self-register"],
    ["POST", "/api/companions/link"],
    ["GET", "/api/admin/members"],
    ["GET", "/api/profile/avatar/file/profiles/legacy/avatar.webp"],
  ] as const;

  for (const [method, url] of removedRoutes) {
    const response = await request.fetch(url, { method, failOnStatusCode: false });
    expect(response.status(), `${method} ${url}`).toBe(404);
  }

  for (const url of ["/api/profile/companion-link", "/api/admin/settings"]) {
    const response = await request.get(url, { failOnStatusCode: false });
    expect(response.status(), `GET ${url}`).toBe(405);
  }
});
