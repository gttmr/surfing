export const QA_TARGET_NAMES = [
  "qa:browsers:install",
  "qa:run",
  "test:unit",
  "test:integration",
  "qa:db:assert",
  "qa:db:up",
  "qa:db:push",
  "qa:db:seed",
  "qa:db:reset",
  "qa:db:down",
  "build:qa",
  "start:qa",
  "test:e2e:mobile",
  "qa:visual",
  "gate:f1",
  "gate:f2",
  "gate:f3",
  "probe:environment",
  "probe:egress",
  "probe:hold-lock",
] as const;

export type QaTargetName = (typeof QA_TARGET_NAMES)[number];

export type QaTarget = {
  readonly name: QaTargetName;
  readonly action: string;
  readonly nodeEnvironment: "development" | "production" | "test";
  readonly ownerLifecycle: boolean;
  readonly implemented: boolean;
  readonly allowedExecutables: readonly string[];
  readonly passthrough: "none" | "node-test" | "playwright" | "visual";
};

const NODE_ONLY = ["node"] as const;
const NODE_AND_DOCKER = ["node", "docker", "schema-engine-debian-openssl-3.0.x"] as const;

export const QA_TARGETS = {
  "qa:browsers:install": { name: "qa:browsers:install", action: "browsers-install", nodeEnvironment: "test", ownerLifecycle: false, implemented: true, allowedExecutables: NODE_ONLY, passthrough: "none" },
  "qa:run": { name: "qa:run", action: "registry-audit", nodeEnvironment: "test", ownerLifecycle: false, implemented: true, allowedExecutables: NODE_ONLY, passthrough: "none" },
  "test:unit": { name: "test:unit", action: "test-unit", nodeEnvironment: "test", ownerLifecycle: false, implemented: true, allowedExecutables: ["node", "tsx", "docker"], passthrough: "node-test" },
  "test:integration": { name: "test:integration", action: "test-integration", nodeEnvironment: "test", ownerLifecycle: true, implemented: true, allowedExecutables: ["node", "docker", "schema-engine-debian-openssl-3.0.x", "chrome", "chromium", "chrome-headless-shell", "chrome_crashpad_handler"], passthrough: "node-test" },
  "qa:db:assert": { name: "qa:db:assert", action: "db-assert", nodeEnvironment: "test", ownerLifecycle: true, implemented: true, allowedExecutables: NODE_AND_DOCKER, passthrough: "none" },
  "qa:db:up": { name: "qa:db:up", action: "db-up", nodeEnvironment: "test", ownerLifecycle: true, implemented: true, allowedExecutables: NODE_AND_DOCKER, passthrough: "none" },
  "qa:db:push": { name: "qa:db:push", action: "db-push", nodeEnvironment: "test", ownerLifecycle: true, implemented: true, allowedExecutables: NODE_AND_DOCKER, passthrough: "none" },
  "qa:db:seed": { name: "qa:db:seed", action: "db-seed", nodeEnvironment: "test", ownerLifecycle: true, implemented: true, allowedExecutables: NODE_AND_DOCKER, passthrough: "none" },
  "qa:db:reset": { name: "qa:db:reset", action: "db-reset", nodeEnvironment: "test", ownerLifecycle: true, implemented: true, allowedExecutables: NODE_AND_DOCKER, passthrough: "none" },
  "qa:db:down": { name: "qa:db:down", action: "db-down", nodeEnvironment: "test", ownerLifecycle: true, implemented: true, allowedExecutables: NODE_AND_DOCKER, passthrough: "none" },
  "build:qa": { name: "build:qa", action: "build", nodeEnvironment: "production", ownerLifecycle: true, implemented: true, allowedExecutables: NODE_AND_DOCKER, passthrough: "none" },
  "start:qa": { name: "start:qa", action: "start", nodeEnvironment: "production", ownerLifecycle: true, implemented: true, allowedExecutables: NODE_ONLY, passthrough: "none" },
  "test:e2e:mobile": { name: "test:e2e:mobile", action: "test-e2e", nodeEnvironment: "test", ownerLifecycle: true, implemented: true, allowedExecutables: ["node", "chromium", "chrome", "chrome-headless-shell", "chrome_crashpad_handler"], passthrough: "playwright" },
  "qa:visual": { name: "qa:visual", action: "not-implemented", nodeEnvironment: "test", ownerLifecycle: true, implemented: false, allowedExecutables: NODE_ONLY, passthrough: "visual" },
  "gate:f1": { name: "gate:f1", action: "not-implemented", nodeEnvironment: "test", ownerLifecycle: true, implemented: false, allowedExecutables: NODE_AND_DOCKER, passthrough: "none" },
  "gate:f2": { name: "gate:f2", action: "not-implemented", nodeEnvironment: "test", ownerLifecycle: true, implemented: false, allowedExecutables: NODE_AND_DOCKER, passthrough: "none" },
  "gate:f3": { name: "gate:f3", action: "not-implemented", nodeEnvironment: "test", ownerLifecycle: true, implemented: false, allowedExecutables: NODE_AND_DOCKER, passthrough: "none" },
  "probe:environment": { name: "probe:environment", action: "probe-environment", nodeEnvironment: "test", ownerLifecycle: false, implemented: true, allowedExecutables: NODE_ONLY, passthrough: "none" },
  "probe:egress": { name: "probe:egress", action: "probe-egress", nodeEnvironment: "test", ownerLifecycle: false, implemented: true, allowedExecutables: NODE_ONLY, passthrough: "none" },
  "probe:hold-lock": { name: "probe:hold-lock", action: "probe-hold-lock", nodeEnvironment: "test", ownerLifecycle: true, implemented: true, allowedExecutables: NODE_ONLY, passthrough: "none" },
} as const satisfies Record<QaTargetName, QaTarget>;

export function isQaTargetName(value: string): value is QaTargetName {
  return Object.hasOwn(QA_TARGETS, value);
}
