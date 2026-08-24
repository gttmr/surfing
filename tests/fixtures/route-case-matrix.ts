import type { QaAuthContextKey } from "./playwright-auth";
import type { MobileUxFixtureKey } from "./mobile-ux";

export type RouteCase = {
  readonly id: string;
  readonly route: string;
  readonly auth: QaAuthContextKey;
  readonly fixture: MobileUxFixtureKey;
  readonly viewport: "both";
  readonly action: "open";
  readonly expected: {
    readonly kind: "shell" | "redirect" | "not-found" | "access-barrier";
    readonly value: string;
  };
};

export const ROUTE_CASE_MATRIX = [
  { id: "R01-public-home", route: "/", auth: "public", fixture: "D0", viewport: "both", action: "open", expected: { kind: "shell", value: "/" } },
  { id: "R02-legacy-meeting", route: "/meeting/8101", auth: "member", fixture: "D0", viewport: "both", action: "open", expected: { kind: "not-found", value: "404" } },
  { id: "R03-create", route: "/meeting/create", auth: "member", fixture: "E0", viewport: "both", action: "open", expected: { kind: "shell", value: "/meeting/create" } },
  { id: "R04-profile", route: "/profile", auth: "member", fixture: "L0", viewport: "both", action: "open", expected: { kind: "shell", value: "/profile" } },
  { id: "R05-settlement", route: "/settlement", auth: "member", fixture: "D0", viewport: "both", action: "open", expected: { kind: "shell", value: "/settlement" } },
  { id: "R06-legacy-confirm", route: "/signup/confirm?status=approved&meetingId=8101&name=%ED%95%A9%EC%84%B1", auth: "public", fixture: "D0", viewport: "both", action: "open", expected: { kind: "not-found", value: "404" } },
  { id: "R07-admin-login", route: "/admin/login", auth: "public", fixture: "E0", viewport: "both", action: "open", expected: { kind: "shell", value: "/admin/login" } },
  { id: "R08-admin-home", route: "/admin", auth: "password-admin", fixture: "D0", viewport: "both", action: "open", expected: { kind: "shell", value: "/admin" } },
  { id: "R09-admin-meetings", route: "/admin/meetings", auth: "kakao-admin", fixture: "D0", viewport: "both", action: "open", expected: { kind: "shell", value: "/admin/meetings" } },
  { id: "R10-admin-meeting", route: "/admin/meetings/8101", auth: "password-admin", fixture: "D0", viewport: "both", action: "open", expected: { kind: "shell", value: "/admin/meetings/8101" } },
  { id: "R11-admin-orders", route: "/admin/meetings/8101/orders", auth: "kakao-admin", fixture: "D0", viewport: "both", action: "open", expected: { kind: "shell", value: "/admin/meetings/8101/orders" } },
  { id: "R12-admin-settlement", route: "/admin/meetings/8101/settlement", auth: "password-admin", fixture: "D0", viewport: "both", action: "open", expected: { kind: "shell", value: "/admin/meetings/8101/settlement" } },
  { id: "R13-admin-members", route: "/admin/members", auth: "kakao-admin", fixture: "L0", viewport: "both", action: "open", expected: { kind: "shell", value: "/admin/members" } },
  { id: "R14-admin-menus", route: "/admin/menus", auth: "password-admin", fixture: "D0", viewport: "both", action: "open", expected: { kind: "shell", value: "/admin/menus" } },
  { id: "R15-admin-pricing", route: "/admin/pricing", auth: "kakao-admin", fixture: "D0", viewport: "both", action: "open", expected: { kind: "shell", value: "/admin/pricing" } },
  { id: "R16-admin-settings", route: "/admin/settings", auth: "password-admin", fixture: "L0", viewport: "both", action: "open", expected: { kind: "shell", value: "/admin/settings" } },
  { id: "R17-shop-orders", route: "/shop", auth: "shop", fixture: "D0", viewport: "both", action: "open", expected: { kind: "shell", value: "/shop" } },
  { id: "R18-shop-usage", route: "/shop/usage", auth: "shop", fixture: "D0", viewport: "both", action: "open", expected: { kind: "shell", value: "/shop/usage" } },
  { id: "R19-shop-menus", route: "/shop/menus", auth: "shop", fixture: "D0", viewport: "both", action: "open", expected: { kind: "shell", value: "/shop/menus" } },
  { id: "B01-admin-member-denied", route: "/admin", auth: "member", fixture: "D0", viewport: "both", action: "open", expected: { kind: "access-barrier", value: "/admin/login" } },
  { id: "B02-shop-guest-oauth", route: "/shop", auth: "public", fixture: "D0", viewport: "both", action: "open", expected: { kind: "access-barrier", value: "/api/auth/kakao?returnTo=" } },
  { id: "B03-shop-member-denied", route: "/shop", auth: "member", fixture: "D0", viewport: "both", action: "open", expected: { kind: "access-barrier", value: "/" } },
] as const satisfies readonly RouteCase[];
