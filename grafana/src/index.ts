import * as pulumi from "@pulumi/pulumi";

import {
  getPostgresProvider,
  getVaultProvider,
  Grafana,
  InfrastructureStackOutputs,
  InfrastructureStackRef,
} from "@sprocketbot/infra-lib";
import {
  discordOauthSecret,
  githubOauthSecret,
  smtpSecret,
} from "./grafana.secrets";
import { BuildGrafanaDatasources } from "./grafana.datasources";
import { GrafanaAlerting } from "./alerts/grafana.alerting";
import { GrafanaDashboards } from "./dashboards/grafana.dashboards";
if (InfrastructureStackRef === null)
  throw new Error(
    "Infrastructure Stack Reference is null! This should never happen.",
  );

const grafanaInstance = new Grafana(
  "grafana",
  {
    configFilePath: "./src/config/grafana.hbs.ini",
    networks: {
      ingress: InfrastructureStackRef.getOutput(
        InfrastructureStackOutputs.IngressNetworkId,
      ),
      monitoring: InfrastructureStackRef.getOutput(
        InfrastructureStackOutputs.MonitoringNetworkId,
      ),
      postgres: InfrastructureStackRef.getOutput(
        InfrastructureStackOutputs.PostgresNetworkId,
      ),
    },
    pg: {
      hostname: InfrastructureStackRef.getOutput(
        InfrastructureStackOutputs.PostgresInternalHostname,
      ),
      vaultConnName: InfrastructureStackRef.getOutput(
        InfrastructureStackOutputs.PostgresVaultConnectionName,
      ),
    },
    configFileVars: {
      discord_oauth: discordOauthSecret,
      github_oauth: githubOauthSecret,
      smtp: smtpSecret,
    },
  },
  {
    providers: { vault: getVaultProvider(), postgresql: getPostgresProvider() },
  },
);

const datasources = BuildGrafanaDatasources(
  grafanaInstance.provider,
  getVaultProvider(),
);

new GrafanaAlerting(
  "alerts",
  {},
  {
    providers: [
      getVaultProvider(),
      getPostgresProvider(),
      grafanaInstance.provider,
    ],
  },
);

new GrafanaDashboards(
  "dashboards",
  {
    datasources: datasources,
  },
  {
    providers: [
      getVaultProvider(),
      getPostgresProvider(),
      grafanaInstance.provider,
    ],
  },
);

export const AdminCredsPath = grafanaInstance.adminCreds.path;
export const GrafanaUrl = pulumi
  .output(grafanaInstance.hostname)
  .apply(($hostname) => `https://${$hostname}`);
