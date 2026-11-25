const { execSync } = require("node:child_process");
const path = require("node:path");

module.exports = async function globalSetup() {
  const databaseUrl = "postgresql://itsm:itsm_dev_only@localhost:5432/itsm_test?schema=public";
  const env = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "test" };
  const cwd = path.resolve(__dirname, "../../database");
  execSync("npx prisma migrate deploy", { cwd, env, stdio: "inherit" });
  execSync("npx prisma db seed", { cwd, env, stdio: "inherit" });
};
