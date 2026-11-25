require("dotenv").config({ path: "apps/api/.env" });
const { Client } = require("pg");

(async () => {
  const client = new Client({
    connectionString: process.env.TEST_DATABASE_URL
  });

  try {
    await client.connect();

    const tables = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name ILIKE '%invoice%'
         OR table_name ILIKE '%drizzle%'
      ORDER BY table_schema, table_name
    `);

    console.log("\nALL INVOICE / MIGRATION TABLES:");
    console.table(tables.rows);

    const columns = await client.query(`
      SELECT table_schema, table_name, column_name
      FROM information_schema.columns
      WHERE table_name = 'invoices'
      ORDER BY table_schema, ordinal_position
    `);

    console.log("\nALL INVOICES COLUMNS:");
    console.table(columns.rows);

    const histories = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name = '__drizzle_migrations'
    `);

    console.log("\nMIGRATION HISTORY TABLES:");
    console.table(histories.rows);

    for (const row of histories.rows) {
      const result = await client.query(
        `SELECT * FROM "${row.table_schema}"."${row.table_name}" ORDER BY created_at DESC LIMIT 10`
      );
      console.log(`\nHISTORY: ${row.table_schema}`);
      console.table(result.rows);
    }
  } catch (error) {
    console.error(error);
  } finally {
    await client.end();
  }
})();
