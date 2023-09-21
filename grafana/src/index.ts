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

if (InfrastructureStackRef === null)
  throw new Error(
    "Infrastructure Stack Reference is null! This should never happen.",
  );

const grafanaInstance = new Grafana(
  "grafana",
  {
    configFilePath: "./src/config/grafana.ini",
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

BuildGrafanaDatasources(grafanaInstance.provider, getVaultProvider());
