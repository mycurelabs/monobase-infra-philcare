/**
 * Seed script for PhilCare Staging
 * Creates a demo organization with 7 role-based user accounts.
 *
 * Usage:
 *   bun run scripts/seed.ts
 *   bun run scripts/seed.ts --api-url https://api.stg.mycure.stitchtechsolutions.com
 */

const API_URL =
  process.argv.find((a) => a.startsWith("--api-url="))?.split("=")[1] ??
  "https://api.stg.mycure.stitchtechsolutions.com";

const PASSWORD = "PhilCare2026!";

// ---------------------------------------------------------------------------
// Role → privilege mapping (from @lfh/sdk organizations/constants)
// ---------------------------------------------------------------------------

const ROLE_PRIVILEGES: Record<string, string[]> = {
  admin: [
    "members", "org_configs", "partners", "analytics", "activityLogsRead",
    "attendanceRead", "attendanceWrite", "attendanceOpen", "attendanceClose",
    "mf_patientCreate", "mf_patientRead", "mf_patientUpdate",
    "queue_remove", "queue_items", "queue_ops", "queue_create", "queueMonitor",
    "mf_registrationKiosk", "aptmnt_items",
    "med_recordsRead", "frm_templatesRead", "med_recordsAnalytics",
    "mf_encounters",
    "bl_invoices", "bl_invoiceItems", "bl_payments", "mf_services",
    "bl_expenses", "bl_soas", "bl_analytics", "bl_reports",
    "wh_products", "wh_productTypes", "wh_productCategories",
    "wh_purchases", "wh_transfers", "wh_receiving", "wh_adjustments",
    "wh_packaging", "wh_stockAdjustmentReasons", "wh_reports", "wh_suppliers", "wh_pos",
    "pharmacy_reports",
    "lis_testsRead", "lis_ordersRead", "lis_resultsRead", "lis_analyzersRead",
    "lis_ordersUpdateFinalized", "lis_analytics",
    "ris_testsRead", "ris_ordersRead", "ris_resultsRead",
    "ris_ordersUpdateFinalized", "ris_analytics",
    "insurance_contractsRead", "insurance_contractsUpdate",
    "mf_dentalFixtures", "mf_reports", "sms_send",
  ],
  doctor: [
    "mf_patientRead", "queue_items", "queue_ops", "queueMonitor",
    "aptmnt_items", "med_records", "frm_templates", "med_recordsAnalytics",
    "mf_encounters", "bl_invoices", "bl_invoiceItems",
    "lis_testsRead", "lis_ordersRead", "lis_resultsRead",
    "ris_testsRead", "ris_ordersRead", "ris_resultsRead",
    "mf_dentalFixtures",
  ],
  nurse: [
    "mf_patientCreate", "mf_patientRead", "mf_patientUpdate",
    "queue_items", "queueMonitor", "mf_registrationKiosk", "aptmnt_items",
    "med_records", "frm_templates", "med_recordsAnalytics",
    "mf_encounters", "bl_invoices", "bl_invoiceItems", "bl_paymentsRead",
    "mf_servicesRead",
    "lis_testsRead", "lis_ordersRead", "lis_resultsRead",
    "ris_testsRead", "ris_ordersRead", "ris_resultsRead",
    "mf_dentalFixtures",
  ],
  billing: [
    "mf_patientRead",
    "bl_invoices", "bl_invoiceItems", "bl_payments", "bl_expenses",
    "mf_encounters", "mf_servicesRead", "queue_items",
  ],
  med_tech: [
    "mf_patientRead", "queue_items", "queueMonitor", "aptmnt_items",
    "mf_encountersRead",
    "bl_invoicesRead", "bl_invoiceItemsRead", "bl_paymentsRead",
    "lis_testsRead", "lis_orders", "lis_results",
    "lis_printClaimStub", "lis_printResults",
    "lis_ordersSendout", "lis_ordersComplete", "lis_ordersVerify",
  ],
  radiologic_tech: [
    "mf_patientRead", "queue_items", "queueMonitor", "aptmnt_items",
    "mf_encountersRead",
    "bl_invoicesRead", "bl_paymentsRead",
    "ris_testsRead", "frm_templatesRead",
    "ris_orders", "ris_results",
    "ris_ordersSendout", "ris_ordersComplete", "ris_ordersVerify",
  ],
};

// ---------------------------------------------------------------------------
// User definitions
// ---------------------------------------------------------------------------

interface SeedUser {
  email: string;
  name: string;
  roleId: string | null;    // role ID for roles[] array (null = superadmin)
  superadmin: boolean;
}

const USERS: SeedUser[] = [
  { email: "superadmin@philcare.test", name: "Super Admin",    roleId: null,              superadmin: true },
  { email: "admin@philcare.test",      name: "Org Admin",      roleId: "admin",           superadmin: false },
  { email: "doctor@philcare.test",     name: "Dr. Juan Cruz",  roleId: "doctor",          superadmin: false },
  { email: "nurse@philcare.test",      name: "Maria Santos",   roleId: "nurse",           superadmin: false },
  { email: "cashier@philcare.test",    name: "Ana Reyes",      roleId: "billing",         superadmin: false },
  { email: "laboratory@philcare.test", name: "Lab Tech",       roleId: "med_tech",        superadmin: false },
  { email: "imaging@philcare.test",    name: "Imaging Tech",   roleId: "radiologic_tech", superadmin: false },
];

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

let sessionCookie = "";

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (sessionCookie) headers["Cookie"] = sessionCookie;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });

  // Capture set-cookie for session
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    if (c.startsWith("better-auth.session_token=") || c.startsWith("__Secure-better-auth.session_token=")) {
      sessionCookie = c.split(";")[0];
    }
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

// ---------------------------------------------------------------------------
// Seed logic
// ---------------------------------------------------------------------------

async function signUp(email: string, password: string, name: string) {
  const data = (await api("POST", "/auth/sign-up/email", {
    email,
    password,
    name,
  })) as { user?: { id: string }; token?: string };
  return data;
}

async function signIn(email: string, password: string) {
  const data = (await api("POST", "/auth/sign-in/email", {
    email,
    password,
  })) as { user?: { id: string }; token?: string };
  return data;
}

async function createOrganization(name: string, type: string) {
  const data = (await api("POST", "/organizations", {
    name,
    type,
    description: "PhilCare demo clinic for staging verification",
  })) as { id?: string };
  return data;
}

async function createMember(
  uid: string,
  organization: string,
  user: SeedUser,
) {
  const privileges: Record<string, boolean> = {};

  if (user.superadmin) {
    privileges.superadmin = true;
  } else if (user.roleId && ROLE_PRIVILEGES[user.roleId]) {
    for (const priv of ROLE_PRIVILEGES[user.roleId]) {
      privileges[priv] = true;
    }
  }

  const body: Record<string, unknown> = {
    uid,
    organization,
    roles: user.roleId ? [user.roleId] : [],
    superadmin: user.superadmin,
    admin: user.superadmin || user.roleId === "admin",
    ...privileges,
  };

  return api("POST", "/organization-members", body);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nPhilCare Staging Seed Script`);
  console.log(`API: ${API_URL}\n`);

  // Step 1: Sign up all users
  console.log("1. Creating user accounts...");
  const userIds: Record<string, string> = {};

  for (let i = 0; i < USERS.length; i++) {
    const user = USERS[i];
    // Delay between signups to avoid rate limiting
    if (i > 0) await new Promise((r) => setTimeout(r, 2000));
    try {
      sessionCookie = "";
      const result = await signUp(user.email, PASSWORD, user.name);
      userIds[user.email] = result.user?.id ?? "";
      console.log(`   ✓ ${user.email} (${userIds[user.email]})`);
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg.includes("already exists") || msg.includes("UNIQUE") || msg.includes("duplicate")) {
        console.log(`   ~ ${user.email} (already exists, signing in...)`);
        sessionCookie = "";
        const signInResult = await signIn(user.email, PASSWORD);
        userIds[user.email] = signInResult.user?.id ?? "";
        console.log(`   ✓ ${user.email} (${userIds[user.email]})`);
      } else if (msg.includes("429")) {
        console.log(`   ~ ${user.email} (rate limited, waiting 10s...)`);
        await new Promise((r) => setTimeout(r, 10000));
        i--; // retry
      } else {
        console.error(`   ✗ ${user.email}: ${msg}`);
      }
    }
  }

  // Step 2: Sign in as superadmin
  console.log("\n2. Signing in as superadmin...");
  sessionCookie = "";
  await signIn("superadmin@philcare.test", PASSWORD);
  console.log("   ✓ Authenticated");

  // Step 3: Create organization
  console.log("\n3. Creating organization...");
  let orgId: string;
  try {
    const org = await createOrganization("PhilCare Demo Clinic", "facility");
    orgId = org.id ?? "";
    console.log(`   ✓ Organization created (${orgId})`);
  } catch (err: unknown) {
    const msg = (err as Error).message;
    console.error(`   ✗ Failed to create org: ${msg}`);
    console.log("   Attempting to find existing org...");
    // Try to list organizations and find ours
    const orgs = (await api("GET", "/organizations?name=PhilCare Demo Clinic")) as
      { data?: Array<{ id: string }> } | Array<{ id: string }>;
    const orgList = Array.isArray(orgs) ? orgs : orgs.data ?? [];
    if (orgList.length > 0) {
      orgId = orgList[0].id;
      console.log(`   ✓ Found existing org (${orgId})`);
    } else {
      console.error("   ✗ Could not find or create organization. Aborting.");
      process.exit(1);
    }
  }

  // Step 4: Create organization members
  console.log("\n4. Creating organization members...");
  for (const user of USERS) {
    const uid = userIds[user.email];
    if (!uid) {
      console.log(`   ✗ ${user.email}: no user ID, skipping`);
      continue;
    }
    try {
      await createMember(uid, orgId!, user);
      const roleLabel = user.superadmin
        ? "superadmin"
        : user.roleId ?? "none";
      console.log(`   ✓ ${user.email} → ${roleLabel}`);
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg.includes("duplicate") || msg.includes("UNIQUE") || msg.includes("already")) {
        console.log(`   ~ ${user.email} → already a member`);
      } else {
        console.error(`   ✗ ${user.email}: ${msg}`);
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SEED COMPLETE");
  console.log("=".repeat(60));
  console.log(`\nOrganization: PhilCare Demo Clinic (${orgId!})`);
  console.log(`\nAccounts (password: ${PASSWORD}):`);
  console.log("-".repeat(60));
  console.log(
    `${"Email".padEnd(32)} ${"Role".padEnd(18)} ${"Privileges"}`,
  );
  console.log("-".repeat(60));
  for (const user of USERS) {
    const role = user.superadmin ? "superadmin" : user.roleId ?? "—";
    const privCount = user.superadmin
      ? "ALL"
      : String(ROLE_PRIVILEGES[user.roleId!]?.length ?? 0);
    console.log(
      `${user.email.padEnd(32)} ${role.padEnd(18)} ${privCount}`,
    );
  }
  console.log("-".repeat(60));
  console.log(
    `\nLogin at: https://cms.stg.mycure.stitchtechsolutions.com`,
  );
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
