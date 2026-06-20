import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import type {
  Organisation,
  OrganisationLink,
  PassportExport,
} from "./types";

const STORE_PATH = join(process.cwd(), ".aurevix-data", "automation-passports.json");
const DEFAULT_ORG: Organisation = { org_id: "org-aurevix-demo", name: "Aurevix Demo Organisation" };

interface PassportStoreShape {
  passports: Record<string, PassportExport>;
  organisations: Record<string, Organisation>;
  links: OrganisationLink[];
}

declare global {
  // eslint-disable-next-line no-var
  var __aurevixPassportStore: PassportStoreShape | undefined;
}

async function getStore(): Promise<PassportStoreShape> {
  if (globalThis.__aurevixPassportStore) return globalThis.__aurevixPassportStore;
  try {
    globalThis.__aurevixPassportStore = JSON.parse(
      await readFile(STORE_PATH, "utf-8"),
    ) as PassportStoreShape;
  } catch {
    globalThis.__aurevixPassportStore = {
      passports: {},
      organisations: { [DEFAULT_ORG.org_id]: DEFAULT_ORG },
      links: [],
    };
  }
  return globalThis.__aurevixPassportStore;
}

async function persist(store: PassportStoreShape) {
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export async function savePassport(passport: PassportExport) {
  const store = await getStore();
  if (store.passports[passport.passport_id]) {
    throw new Error("Passport identifiers are immutable and cannot be overwritten.");
  }
  store.passports[passport.passport_id] = passport;
  await persist(store);
}

export async function getPassport(id: string) {
  return (await getStore()).passports[id];
}

export async function listPassportsForOrganisation(orgId: string) {
  const store = await getStore();
  const linkedOrgIds = new Set(
    store.links.flatMap((link) => {
      if (link.organisation_a_id === orgId) return [link.organisation_b_id];
      if (link.organisation_b_id === orgId) return [link.organisation_a_id];
      return [];
    }),
  );
  return Object.values(store.passports)
    .filter((passport) => {
      if (passport.source_org_id === orgId && passport.sharing_scope !== "PRIVATE") return true;
      if (passport.recipient_org_id === orgId) return true;
      return passport.sharing_scope === "ORGANISATION" && linkedOrgIds.has(passport.source_org_id);
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createOrganisationLink(
  organisationAId: string,
  organisationBId: string,
  createdBy: string,
) {
  if (organisationAId === organisationBId) throw new Error("An organisation cannot link to itself.");
  const store = await getStore();
  const existing = store.links.find(
    (link) =>
      [link.organisation_a_id, link.organisation_b_id].includes(organisationAId) &&
      [link.organisation_a_id, link.organisation_b_id].includes(organisationBId),
  );
  if (existing) return existing;
  const link: OrganisationLink = {
    link_id: randomUUID(),
    organisation_a_id: organisationAId,
    organisation_b_id: organisationBId,
    created_at: new Date().toISOString(),
    created_by: createdBy,
  };
  store.links.push(link);
  if (!store.organisations[organisationAId]) {
    store.organisations[organisationAId] = { org_id: organisationAId, name: organisationAId };
  }
  if (!store.organisations[organisationBId]) {
    store.organisations[organisationBId] = { org_id: organisationBId, name: organisationBId };
  }
  await persist(store);
  return link;
}
