import { BuildVault } from "./BuildVault";
import { Traefik } from "@sprocketbot/infra-lib";
import { TimescaleDb } from "@sprocketbot/infra-lib/bin/src/services/timescaledb/TimescaleDb";
import { BuildTimescale } from "./BuildTimescale";

const traefik = new Traefik("traefik", {
  staticConfigPath: "./src/config/traefik.yaml",
  forwardAuthConfigPath: "./src/config/traefik-forward-auth.yaml",
});

const vaultResult = BuildVault({
  traefik,
  configFilepath: `./src/config/vault.hcl`,
});
const timescaleResult = BuildTimescale({
  traefik,
  configPaths: {
    "pg_hba.conf": "./src/config/pg_hba.conf",
    "postgresql.conf": "./src/config/postgresql.conf",
  },
  vault: vaultResult.provider,
});
