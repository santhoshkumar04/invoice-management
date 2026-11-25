import "dotenv/config";

import { eq } from "drizzle-orm";

import { db, closeDatabase } from "../client.js";

import { organizations } from "../schema/organizations.js";
import { users } from "../schema/users.js";

import { hashPassword } from "../../modules/auth/services/password.service.js";

async function createInitialAdmin() {
  const organizationName = process.env.ORGANIZATION_NAME;
  const adminName = process.env.ADMIN_NAME;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!organizationName || !adminName || !adminEmail || !adminPassword) {
    throw new Error(
      "Organization and Admin environment variables are required",
    );
  }

  if (adminPassword.length < 8) {
    throw new Error(
      "Initial Admin password must contain at least 12 characters",
    );
  }

  const normalizedEmail = adminEmail.trim().toLowerCase();

  const existingOrganizations = await db.select().from(organizations).limit(1);

  let organizationId: string;

  if (existingOrganizations.length > 0) {
    organizationId = existingOrganizations[0]!.id;
  } else {
    const [organization] = await db
      .insert(organizations)
      .values({
        name: organizationName.trim(),
        country: "India",
      })
      .returning();

    if (!organization) {
      throw new Error("Could not create organization");
    }

    organizationId = organization.id;
  }

  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existingAdmin.length > 0) {
    throw new Error(
      "An account with this email already exists. No account was created.",
    );
  }

  const passwordHash = await hashPassword(adminPassword);

  const [admin] = await db
    .insert(users)
    .values({
      organizationId,
      fullName: adminName.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "admin",
      isActive: true,
    })
    .returning({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
    });

  if (!admin) {
    throw new Error("Admin creation failed");
  }

  console.log("Initial Admin created successfully.");
  console.log({
    id: admin.id,
    fullName: admin.fullName,
    email: admin.email,
    role: admin.role,
  });
}

try {
  await createInitialAdmin();
} catch (error) {
  console.error("Admin setup failed:", error);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
