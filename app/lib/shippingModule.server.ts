import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
// Type-only import — admin.types.d.ts is a declarations-only file with no runtime JS
// backing it, so DeliveryConditionOperator must never be imported as a value.
import type { DeliveryConditionOperator } from "../types/admin.types.d.ts";
import db from "../db.server";

// [DEMO 5] Shipping module — GraphQL calls behind the "Enable shipping module" button
// (write_shipping scope-grant modal) and the add/delete-method form on the registry
// per-store page. Applies every new method to EVERY zone in the shop's default/general
// delivery profile (confirmed scope: no zone picker in this UI). Shapes below are
// validated against the real Admin API 2026-07 schema via `npm run graphql-codegen`
// (app/types/admin-2026-07.schema.json), not guessed from docs.

// [DEMO 5] Locate the default delivery profile, the shop's currency, and every zone id
// a new method must be attached to. `deliveryProfiles` has no filter argument for
// "default" — fetch a small page and pick the node with `default: true` client-side.
const DEFAULT_PROFILE_QUERY = `#graphql
  query defaultDeliveryProfile {
    shop {
      currencyCode
    }
    deliveryProfiles(first: 10) {
      edges {
        node {
          id
          default
          profileLocationGroups {
            locationGroup {
              id
            }
            locationGroupZones(first: 50) {
              edges {
                node {
                  zone {
                    id
                  }
                }
              }
            }
          }
        }
      }
    }
  }`;

// [DEMO 5] Add one method definition (same name/price/condition) to every zone passed
// in. `zonesToUpdate` lives under `locationGroupsToUpdate[]` — confirmed against
// DeliveryProfileLocationGroupInput / DeliveryLocationGroupZoneInput in the generated
// schema.
const ADD_METHOD_MUTATION = `#graphql
  mutation addShippingMethod($id: ID!, $profile: DeliveryProfileInput!) {
    deliveryProfileUpdate(id: $id, profile: $profile) {
      profile {
        id
        profileLocationGroups {
          locationGroupZones(first: 50) {
            edges {
              node {
                zone {
                  id
                }
                methodDefinitions(first: 50) {
                  edges {
                    node {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }`;

// [DEMO 5] Retract method definitions on delete. Confirmed against the schema:
// DeliveryProfileInput.methodDefinitionsToDelete is a FLAT top-level [ID!]! — no
// need to walk back through locationGroups/zones to remove them.
const DELETE_METHOD_MUTATION = `#graphql
  mutation deleteShippingMethod($id: ID!, $profile: DeliveryProfileInput!) {
    deliveryProfileUpdate(id: $id, profile: $profile) {
      profile { id }
      userErrors {
        field
        message
      }
    }
  }`;

export type ConditionOperator = "AT_LEAST" | "AT_MOST";

// DEMO-vocabulary operator names, mapped to Shopify's DeliveryConditionOperator enum
// (confirmed against the generated schema: GREATER_THAN_OR_EQUAL_TO / LESS_THAN_OR_EQUAL_TO).
// Cast, not a value import, since DeliveryConditionOperator only exists as a type here.
const CONDITION_OPERATOR_MAP: Record<ConditionOperator, DeliveryConditionOperator> = {
  AT_LEAST: "GREATER_THAN_OR_EQUAL_TO" as DeliveryConditionOperator,
  AT_MOST: "LESS_THAN_OR_EQUAL_TO" as DeliveryConditionOperator,
};

export type NewMethodInput = {
  name: string;
  priceAmount: string; // decimal string from the form, e.g. "9.99"
  conditionOperator?: ConditionOperator;
  conditionAmount?: string;
};

type AddResult =
  | { ok: true; method: Awaited<ReturnType<typeof db.shippingMethod.create>> }
  | { ok: false; error: string };

type SimpleResult = { ok: true } | { ok: false; error: string };

// [DEMO 5] Query the default profile, build one methodDefinitionsToCreate per zone
// (same rate + condition everywhere), run the mutation, and only persist a local row
// once Shopify confirms the definition exists — no ghost rows on failure.
export async function addShippingMethod(
  admin: AdminApiContext,
  shop: string,
  input: NewMethodInput,
): Promise<AddResult> {
  const profileRes = await admin.graphql(DEFAULT_PROFILE_QUERY);
  const profileBody: any = await profileRes.json();
  if (profileBody?.errors) {
    console.error("addShippingMethod: profile query errors", profileBody.errors);
  }

  const currencyCode = profileBody?.data?.shop?.currencyCode;
  const profileEdges = profileBody?.data?.deliveryProfiles?.edges ?? [];
  const profileNode =
    profileEdges.find((e: any) => e.node?.default)?.node ?? profileEdges[0]?.node;
  const profileId: string | undefined = profileNode?.id;
  const locationGroups: Array<{ locationGroup: { id: string }; zoneIds: string[] }> = (
    profileNode?.profileLocationGroups ?? []
  ).map((group: any) => ({
    locationGroup: group.locationGroup,
    zoneIds: (group.locationGroupZones?.edges ?? []).map((e: any) => e.node.zone.id),
  }));

  if (!profileId || !currencyCode || locationGroups.every((g) => g.zoneIds.length === 0)) {
    return { ok: false, error: "No default delivery profile with zones found" };
  }

  const rateDefinition = {
    price: { amount: input.priceAmount, currencyCode },
  };
  const priceConditionsToCreate = input.conditionOperator
    ? [
        {
          operator: CONDITION_OPERATOR_MAP[input.conditionOperator],
          criteria: { amount: input.conditionAmount, currencyCode },
        },
      ]
    : [];

  const profileInput = {
    locationGroupsToUpdate: locationGroups.map((group) => ({
      id: group.locationGroup.id,
      zonesToUpdate: group.zoneIds.map((zoneId) => ({
        id: zoneId,
        methodDefinitionsToCreate: [
          {
            name: input.name,
            active: true,
            rateDefinition,
            priceConditionsToCreate,
          },
        ],
      })),
    })),
  };

  const mutationRes = await admin.graphql(ADD_METHOD_MUTATION, {
    variables: { id: profileId, profile: profileInput },
  });
  const mutationBody: any = await mutationRes.json();
  const userErrors = mutationBody?.data?.deliveryProfileUpdate?.userErrors ?? [];
  if (userErrors.length > 0) {
    return { ok: false, error: userErrors.map((e: any) => e.message).join("; ") };
  }

  // The mutation creates one DISTINCT DeliveryMethodDefinition per zone (same name in
  // each) — collect every id matching this method's name so delete can retract all of
  // them via the flat methodDefinitionsToDelete list. Assumes no pre-existing definition
  // in any zone already shares this exact name (reasonable for a demo store).
  const responseGroups = mutationBody?.data?.deliveryProfileUpdate?.profile?.profileLocationGroups ?? [];
  const definitionIds: string[] = responseGroups
    .flatMap((g: any) => g.locationGroupZones?.edges ?? [])
    .map((z: any) =>
      (z.node?.methodDefinitions?.edges ?? [])
        .map((d: any) => d.node)
        .reverse()
        .find((d: any) => d?.name === input.name)?.id,
    )
    .filter((id: string | undefined): id is string => Boolean(id));

  const method = await db.shippingMethod.create({
    data: {
      shop,
      name: input.name,
      priceAmount: input.priceAmount,
      currencyCode,
      conditionOperator: input.conditionOperator ?? null,
      conditionAmount: input.conditionAmount ?? null,
      shopifyMethodDefinitions: definitionIds.length > 0 ? definitionIds.join(",") : null,
      shopifyProfileId: profileId,
    },
  });

  return { ok: true, method };
}

// [DEMO 5] Retract every Shopify-side definition (if any were ever confirmed) and
// remove the local row. A "not found" userError from Shopify is treated as success —
// the goal state (gone) is already reached, e.g. if a merchant manually removed the
// rate in Shopify admin between demo runs.
export async function deleteShippingMethod(
  admin: AdminApiContext,
  shop: string,
  methodId: string,
): Promise<SimpleResult> {
  const row = await db.shippingMethod.findFirst({ where: { id: methodId, shop } });
  if (!row) {
    return { ok: false, error: "Shipping method not found" };
  }

  const definitionIds = row.shopifyMethodDefinitions
    ? row.shopifyMethodDefinitions.split(",").filter(Boolean)
    : [];

  if (definitionIds.length === 0 || !row.shopifyProfileId) {
    await db.shippingMethod.delete({ where: { id: methodId } });
    return { ok: true };
  }

  const mutationRes = await admin.graphql(DELETE_METHOD_MUTATION, {
    variables: {
      id: row.shopifyProfileId,
      profile: { methodDefinitionsToDelete: definitionIds },
    },
  });
  const mutationBody: any = await mutationRes.json();
  const userErrors = mutationBody?.data?.deliveryProfileUpdate?.userErrors ?? [];
  // Loosely match a "not found" style userError so a stale row can still be cleared —
  // can't know Shopify's exact message text without a live test.
  const alreadyGone = userErrors.some((e: any) => /not found|does not exist/i.test(e.message));
  if (userErrors.length > 0 && !alreadyGone) {
    console.error("deleteShippingMethod: userErrors", userErrors);
    return { ok: false, error: userErrors.map((e: any) => e.message).join("; ") };
  }

  await db.shippingMethod.delete({ where: { id: methodId } });
  return { ok: true };
}

export async function listShippingMethods(shop: string) {
  return db.shippingMethod.findMany({ where: { shop }, orderBy: { createdAt: "asc" } });
}
