
const path = require("path");

const apiDir = path.resolve(__dirname, "apps/api");

require(require.resolve("dotenv", {
  paths: [apiDir],
})).config({
  path: path.join(apiDir, ".env"),
});

const { Client } = require(
  require.resolve("pg", { paths: [apiDir] })
);

(async () => {
  const client = new Client({
    connectionString: process.env.TEST_DATABASE_URL
  });

  try {
    await client.connect();

    const db = await client.query(
      "SELECT current_database() AS database"
    );

    console.log("TEST DATABASE:", db.rows[0].database);

    const columns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = '\''public'\''
        AND table_name = '\''invoices'\''
        AND column_name IN (
          '\''cancelled_at'\'',
          '\''cancellation_reason'\''
        )
      ORDER BY column_name
    `);

    console.log("CANCELLATION COLUMNS:", columns.rows);

    const migrations = await client.query(`
      SELECT to_regclass('\''public.__drizzle_migrations'\'')
        AS migration_table
    `);

    console.log("DRIZZLE MIGRATION TABLE:", migrations.rows[0]);

    if (migrations.rows[0].migration_table) {
      const history = await client.query(`
        SELECT *
        FROM public.__drizzle_migrations
        ORDER BY created_at DESC
        LIMIT 5
      `);

      console.log("RECENT MIGRATIONS:", history.rows);
    }
  } catch (error) {
    console.error("DATABASE DIAGNOSTIC ERROR:", error.message);
  } finally {
    await client.end();
  }
})();