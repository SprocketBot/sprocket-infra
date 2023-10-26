import { BuildVault } from "./BuildVault";
import { config, RolyPoly, Traefik } from "@sprocketbot/infra-lib";
import { BuildTimescale } from "./BuildTimescale";
import { Monitoring } from "./Monitoring";
import * as docker from "@pulumi/docker";

const ingressNet = new docker.Network("ingress-net", {
  attachable: true,
  driver: "overlay",
});

const rolyPoly = new RolyPoly("rolypoly", { ingressNetworkId: ingressNet.id });

const traefik = new Traefik("traefik", {
  staticConfigPath: "./src/config/traefik.hbs.yaml",
  forwardAuthConfigPath: "./src/config/traefik-forward-auth.yaml",
  ingressNetwork: ingressNet,
  dnsToken: config.requireSecret("traefik-dns-token"),
});

const vaultResult = BuildVault({
  traefik,
  configFilepath: `./src/config/vault.hbs.hcl`,
});
const timescaleResult = BuildTimescale({
  traefik,
  configPaths: {
    "pg_hba.conf": "./src/config/pg_hba.conf",
    "postgresql.conf": "./src/config/postgresql.hbs.conf",
  },
  vault: vaultResult.provider,
});
const monitoring = new Monitoring(
  "monitoring",
  {
    ingressNetworkId: traefik.network.id,
  },
  {
    providers: {
      vault: vaultResult.provider,
      postgresql: timescaleResult.provider,
    },
  },
);

export const VaultHostname = vaultResult.endpoint;
export const VaultApproleSecretId = vaultResult.approle.secretId;
export const VaultApproleRoleId = vaultResult.approle.roleId;
export const IngressNetworkId = traefik.network.id;
export const MonitoringNetworkId = monitoring.network.id;
export const PostgresNetworkId = timescaleResult.networkId;
export const PostgresExternalHostname = timescaleResult.hostname;
export const PostgresInternalHostname = timescaleResult.serviceName;
export const PostgresVaultConnectionName = timescaleResult.vaultConnectionName;
export const PostgresVaultRootRolePath = timescaleResult.vaultRolePath;
export const LokiUrl = monitoring.loki.url;

export const InfluxUrl = monitoring.influx.url;
export const InfluxAdminToken = monitoring.influx.adminToken;
export const InfluxInternalHostname = monitoring.influx.internalHostname;
