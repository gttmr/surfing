import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

type RecoverySetting = {
  key: string;
  value: string;
};

type RecoveryNotice = {
  title: string;
  body: string;
  isPinned: boolean;
};

type RecoveryMenuOption = {
  label: string;
  price: number;
  displayOrder: number;
};

type RecoveryMenu = {
  name: string;
  price: number;
  isActive: boolean;
  displayOrder: number;
  optionGroupName: string | null;
  options: RecoveryMenuOption[];
};

type RecoveryCategory = {
  name: string;
  displayOrder: number;
  menus: RecoveryMenu[];
};

type RecoveryConfiguration = {
  schemaVersion: 1;
  settings: RecoverySetting[];
  notices: RecoveryNotice[];
  foodMenuCategories: RecoveryCategory[];
  surfUsageDefaults?: unknown[];
};

type CommandOptions = {
  inputPath: string;
  apply: boolean;
  replaceCatalog: boolean;
  replaceNotices: boolean;
};

class RecoveryConfigurationError extends Error {
  readonly name = "RecoveryConfigurationError";
}

function fail(message: string): never {
  throw new RecoveryConfigurationError(message);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function asNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") fail(`${label} must be a boolean`);
  return value;
}

function asNonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    fail(`${label} must be a non-negative safe integer`);
  }
  return Number(value);
}

function assertUnique(values: string[], label: string): void {
  const duplicate = values.find((value, index) => values.indexOf(value) !== index);
  if (duplicate) fail(`${label} contains duplicate value: ${duplicate}`);
}

function parseSettings(value: unknown): RecoverySetting[] {
  const rows = asArray(value, "settings").map((entry, index) => {
    const row = asRecord(entry, `settings[${index}]`);
    return {
      key: asNonEmptyString(row.key, `settings[${index}].key`),
      value: typeof row.value === "string"
        ? row.value
        : fail(`settings[${index}].value must be a string`),
    };
  });
  assertUnique(rows.map((row) => row.key), "settings");
  return rows;
}

function parseNotices(value: unknown): RecoveryNotice[] {
  const rows = asArray(value, "notices").map((entry, index) => {
    const row = asRecord(entry, `notices[${index}]`);
    return {
      title: asNonEmptyString(row.title, `notices[${index}].title`),
      body: asNonEmptyString(row.body, `notices[${index}].body`),
      isPinned: asBoolean(row.isPinned, `notices[${index}].isPinned`),
    };
  });
  assertUnique(rows.map((row) => row.title), "notices");
  if (rows.filter((row) => row.isPinned).length > 1) {
    fail("notices may contain at most one pinned notice");
  }
  return rows;
}

function parseOptions(value: unknown, menuLabel: string): RecoveryMenuOption[] {
  const rows = asArray(value, `${menuLabel}.options`).map((entry, index) => {
    const row = asRecord(entry, `${menuLabel}.options[${index}]`);
    return {
      label: asNonEmptyString(row.label, `${menuLabel}.options[${index}].label`),
      price: asNonNegativeInteger(row.price, `${menuLabel}.options[${index}].price`),
      displayOrder: asNonNegativeInteger(
        row.displayOrder,
        `${menuLabel}.options[${index}].displayOrder`
      ),
    };
  });
  assertUnique(rows.map((row) => row.label), `${menuLabel}.options`);
  assertUnique(rows.map((row) => String(row.displayOrder)), `${menuLabel}.option display orders`);
  return rows;
}

function parseCategories(value: unknown): RecoveryCategory[] {
  const categories = asArray(value, "foodMenuCategories").map((entry, categoryIndex) => {
    const row = asRecord(entry, `foodMenuCategories[${categoryIndex}]`);
    const categoryName = asNonEmptyString(
      row.name,
      `foodMenuCategories[${categoryIndex}].name`
    );
    const menus = asArray(row.menus, `${categoryName}.menus`).map((menuEntry, menuIndex) => {
      const menu = asRecord(menuEntry, `${categoryName}.menus[${menuIndex}]`);
      const menuName = asNonEmptyString(menu.name, `${categoryName}.menus[${menuIndex}].name`);
      const menuLabel = `${categoryName}/${menuName}`;
      const options = parseOptions(menu.options, menuLabel);
      const optionGroupName = menu.optionGroupName === null
        ? null
        : asNonEmptyString(menu.optionGroupName, `${menuLabel}.optionGroupName`);
      if (options.length > 0 && !optionGroupName) {
        fail(`${menuLabel} has options but no optionGroupName`);
      }
      if (options.length === 0 && optionGroupName !== null) {
        fail(`${menuLabel} has an optionGroupName but no options`);
      }
      return {
        name: menuName,
        price: asNonNegativeInteger(menu.price, `${menuLabel}.price`),
        isActive: asBoolean(menu.isActive, `${menuLabel}.isActive`),
        displayOrder: asNonNegativeInteger(menu.displayOrder, `${menuLabel}.displayOrder`),
        optionGroupName,
        options,
      };
    });
    assertUnique(menus.map((menu) => menu.name), `${categoryName}.menus`);
    assertUnique(menus.map((menu) => String(menu.displayOrder)), `${categoryName}.menu display orders`);
    return {
      name: categoryName,
      displayOrder: asNonNegativeInteger(
        row.displayOrder,
        `foodMenuCategories[${categoryIndex}].displayOrder`
      ),
      menus,
    };
  });
  assertUnique(categories.map((category) => category.name), "foodMenuCategories");
  assertUnique(
    categories.map((category) => String(category.displayOrder)),
    "foodMenuCategories display orders"
  );
  assertUnique(
    categories.flatMap((category) => category.menus.map((menu) => menu.name)),
    "food menu names across categories"
  );
  return categories;
}

export function parseRecoveryConfiguration(value: unknown): RecoveryConfiguration {
  const root = asRecord(value, "recovery configuration");
  if (root.schemaVersion !== 1) fail("schemaVersion must be 1");
  const settings = parseSettings(root.settings);
  const notices = parseNotices(root.notices);
  const foodMenuCategories = parseCategories(root.foodMenuCategories);
  if (settings.length === 0) fail("settings must not be empty");
  if (foodMenuCategories.length === 0) fail("foodMenuCategories must not be empty");
  return {
    schemaVersion: 1,
    settings,
    notices,
    foodMenuCategories,
    surfUsageDefaults: Array.isArray(root.surfUsageDefaults) ? root.surfUsageDefaults : undefined,
  };
}

function parseCommandOptions(argv: string[]): CommandOptions {
  let inputPath = "";
  let apply = false;
  let replaceCatalog = false;
  let replaceNotices = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") {
      inputPath = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--apply") {
      apply = true;
    } else if (arg === "--replace-catalog") {
      replaceCatalog = true;
    } else if (arg === "--replace-notices") {
      replaceNotices = true;
    } else if (arg === "--help") {
      printUsage();
      process.exit(0);
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }

  if (!inputPath) fail("--input is required");
  if (!apply && (replaceCatalog || replaceNotices)) {
    fail("replacement flags require --apply");
  }
  return { inputPath: resolve(inputPath), apply, replaceCatalog, replaceNotices };
}

function printUsage(): void {
  console.log([
    "Usage:",
    "  npm run recovery:config -- --input /absolute/path/to/recovery.json",
    "  npm run recovery:config -- --input /absolute/path/to/recovery.json --apply --replace-catalog --replace-notices",
    "",
    "Dry-run is the default and does not connect to a database.",
    "Apply mode reads only RECOVERY_DATABASE_URL and requires target and manifest confirmations.",
  ].join("\n"));
}

function databaseIdentity(databaseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return fail("RECOVERY_DATABASE_URL is not a valid URL");
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    fail("RECOVERY_DATABASE_URL must use the postgresql protocol");
  }
  const username = decodeURIComponent(parsed.username);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!username || !parsed.hostname || !database) {
    fail("RECOVERY_DATABASE_URL must include username, host, and database");
  }
  return `${username}@${parsed.hostname}:${parsed.port || "5432"}/${database}`;
}

function manifestSummary(configuration: RecoveryConfiguration) {
  const menus = configuration.foodMenuCategories.flatMap((category) => category.menus);
  const activeMenus = menus.filter((menu) => menu.isActive);
  const activeVariants = activeMenus.reduce(
    (sum, menu) => sum + Math.max(1, menu.options.length),
    0
  );
  return {
    settings: configuration.settings.length,
    notices: configuration.notices.length,
    categories: configuration.foodMenuCategories.length,
    menus: menus.length,
    activeMenus: activeMenus.length,
    activeVariants,
    surfUsageDefaults: configuration.surfUsageDefaults?.length ?? 0,
  };
}

async function restoreConfiguration(
  configuration: RecoveryConfiguration,
  options: CommandOptions,
  databaseUrl: string
): Promise<void> {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await prisma.$transaction(async (transaction) => {
      for (const setting of configuration.settings) {
        await transaction.setting.upsert({
          where: { key: setting.key },
          update: { value: setting.value },
          create: setting,
        });
      }

      if (options.replaceNotices) {
        await transaction.notice.deleteMany();
        if (configuration.notices.length > 0) {
          await transaction.notice.createMany({ data: configuration.notices });
        }
      } else {
        for (const notice of configuration.notices) {
          const matches = await transaction.notice.findMany({
            where: { title: notice.title },
            select: { id: true },
          });
          if (matches.length > 1) {
            fail(`multiple existing notices match title: ${notice.title}`);
          }
          if (notice.isPinned) {
            await transaction.notice.updateMany({
              where: { isPinned: true, NOT: matches[0] ? { id: matches[0].id } : undefined },
              data: { isPinned: false },
            });
          }
          if (matches[0]) {
            await transaction.notice.update({ where: { id: matches[0].id }, data: notice });
          } else {
            await transaction.notice.create({ data: notice });
          }
        }
      }

      if (options.replaceCatalog) {
        await transaction.foodMenuOptionChoice.deleteMany();
        await transaction.foodMenuItem.deleteMany();
        await transaction.foodMenuCategory.deleteMany();

        for (const category of configuration.foodMenuCategories) {
          const createdCategory = await transaction.foodMenuCategory.create({
            data: { name: category.name, displayOrder: category.displayOrder },
            select: { id: true },
          });
          for (const menu of category.menus) {
            const createdMenu = await transaction.foodMenuItem.create({
              data: {
                categoryId: createdCategory.id,
                name: menu.name,
                price: menu.price,
                optionGroupName: menu.optionGroupName,
                isActive: menu.isActive,
                displayOrder: menu.displayOrder,
              },
              select: { id: true },
            });
            if (menu.options.length > 0) {
              await transaction.foodMenuOptionChoice.createMany({
                data: menu.options.map((option) => ({
                  menuItemId: createdMenu.id,
                  label: option.label,
                  price: option.price,
                  displayOrder: option.displayOrder,
                })),
              });
            }
          }
        }
      }
    }, { timeout: 60_000 });

    const settingRows = await prisma.setting.findMany({
      where: { key: { in: configuration.settings.map((setting) => setting.key) } },
      select: { key: true, value: true },
    });
    const restoredSettings = new Map(settingRows.map((setting) => [setting.key, setting.value]));
    for (const setting of configuration.settings) {
      if (restoredSettings.get(setting.key) !== setting.value) {
        fail(`setting verification failed: ${setting.key}`);
      }
    }

    if (configuration.notices.length > 0 || options.replaceNotices) {
      const restoredNotices = await prisma.notice.findMany({
        where: options.replaceNotices
          ? undefined
          : { title: { in: configuration.notices.map((notice) => notice.title) } },
        select: { title: true, body: true, isPinned: true },
      });
      restoredNotices.sort((left, right) => left.title.localeCompare(right.title, "ko-KR"));
      const expectedNotices = [...configuration.notices].sort((left, right) =>
        left.title.localeCompare(right.title, "ko-KR")
      );
      if (JSON.stringify(restoredNotices) !== JSON.stringify(expectedNotices)) {
        fail("notice value verification failed");
      }
    }
    if (options.replaceCatalog) {
      const restoredCategories = await prisma.foodMenuCategory.findMany({
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
        select: {
          name: true,
          displayOrder: true,
          menuItems: {
            orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
            select: {
              name: true,
              price: true,
              isActive: true,
              displayOrder: true,
              optionGroupName: true,
              optionChoices: {
                orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
                select: { label: true, price: true, displayOrder: true },
              },
            },
          },
        },
      });
      const normalizedCategories: RecoveryCategory[] = restoredCategories.map((category) => ({
        name: category.name,
        displayOrder: category.displayOrder,
        menus: category.menuItems.map((menu) => ({
          name: menu.name,
          price: menu.price,
          isActive: menu.isActive,
          displayOrder: menu.displayOrder,
          optionGroupName: menu.optionGroupName,
          options: menu.optionChoices.map((option) => ({
            label: option.label,
            price: option.price ?? menu.price,
            displayOrder: option.displayOrder,
          })),
        })),
      }));
      if (JSON.stringify(normalizedCategories) !== JSON.stringify(configuration.foodMenuCategories)) {
        fail("catalog value verification failed");
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const options = parseCommandOptions(process.argv.slice(2));
  const raw = readFileSync(options.inputPath);
  const checksum = createHash("sha256").update(raw).digest("hex");
  const configuration = parseRecoveryConfiguration(JSON.parse(raw.toString("utf8")));
  const summary = manifestSummary(configuration);
  const confirmation = `RESTORE_UI_AUDIT_CONFIGURATION_${checksum.slice(0, 16).toUpperCase()}`;

  console.log(`Manifest: ${options.inputPath}`);
  console.log(`SHA-256: ${checksum}`);
  console.log(`Settings: ${summary.settings}`);
  console.log(`Notices: ${summary.notices}`);
  console.log(`Catalog: ${summary.categories} categories, ${summary.menus} menus, ${summary.activeMenus} active menus, ${summary.activeVariants} active variants`);
  console.log(`Surf usage defaults: ${summary.surfUsageDefaults} reference rows (not written)`);

  if (!options.apply) {
    console.log("Mode: dry-run; no database connection was opened");
    console.log(`Apply confirmation: ${confirmation}`);
    return;
  }

  const databaseUrl = process.env.RECOVERY_DATABASE_URL;
  if (!databaseUrl) fail("RECOVERY_DATABASE_URL is required in apply mode");
  const actualIdentity = databaseIdentity(databaseUrl);
  const expectedIdentity = process.env.RECOVERY_EXPECTED_DATABASE_IDENTITY;
  if (!expectedIdentity || expectedIdentity !== actualIdentity) {
    fail(`RECOVERY_EXPECTED_DATABASE_IDENTITY must exactly equal ${actualIdentity}`);
  }
  if (process.env.RECOVERY_CONFIRMATION !== confirmation) {
    fail(`RECOVERY_CONFIRMATION must exactly equal ${confirmation}`);
  }

  console.log(`Target: ${actualIdentity}`);
  console.log(`Replace notices: ${options.replaceNotices ? "yes" : "no (merge by title)"}`);
  console.log(`Replace catalog: ${options.replaceCatalog ? "yes" : "no (catalog is not written)"}`);
  await restoreConfiguration(configuration, options, databaseUrl);
  console.log("Configuration restore and post-write verification completed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
