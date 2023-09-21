import * as grafana from "@lbrlabs/pulumi-grafana";
import * as pulumi from "@pulumi/pulumi";
import * as vault from "@pulumi/vault";
import {
  buildUrn,
  InfrastructureStackOutputs,
  InfrastructureStackRef,
  URN_TYPE,
  VaultConstants,
  VaultUtils,
} from "@sprocketbot/infra-lib";

export const BuildGrafanaDatasources = (
  grafanaProvider: grafana.Provider,
  vaultProvider: vault.Provider,
) => {
  if (InfrastructureStackRef === null)
    throw new Error(
      "Infrastructure Stack Reference is null! This should never happen.",
    );

  const GrafanaDatasources = new pulumi.ComponentResource(
    buildUrn(URN_TYPE.LogicalGroup, "GrafanaDatasources"),
    "GrafanaDatasources",
    {},
    { providers: { grafana: grafanaProvider } },
  );

  const loki = new grafana.DataSource(
    "loki-ds",
    {
      name: "Loki",
      type: "loki",
      url: InfrastructureStackRef.getOutput(InfrastructureStackOutputs.LokiUrl),
    },
    { parent: GrafanaDatasources, deleteBeforeReplace: true },
  );

  const influxDsSecretData = InfrastructureStackRef.getOutput(
    InfrastructureStackOutputs.InfluxAdminToken,
  ).apply(($token) =>
    JSON.stringify({
      token: $token,
    }),
  );

  const influx = new grafana.DataSource(
    "influx-ds",
    {
      name: "Influx",
      type: "influxdb",
      url: InfrastructureStackRef.getOutput(
        InfrastructureStackOutputs.InfluxInternalHostname,
      ).apply(($name) => `http://${$name}:8086`),
      jsonDataEncoded: JSON.stringify({
        version: "Flux",
        organization: "sprocket",
        default_bucket: "metrics",
      }),
      secureJsonDataEncoded: influxDsSecretData,
    },
    { parent: GrafanaDatasources, deleteBeforeReplace: true },
  );

  const githubAccessToken = vault.kv.getSecretV2Output({
    name: "maintainer/manual/github-pat",
    mount: VaultConstants.Backend.kv2
  }, { provider: vaultProvider}).apply($data => $data.data.accessToken as string);
  
  const github = new grafana.DataSource(
    "github-ds",
    {
      name: "GitHub",
      type: "grafana-github-datasource",
      secureJsonDataEncoded: githubAccessToken.apply($pat => JSON.stringify({accessToken: $pat})),
    },
    { parent: GrafanaDatasources, deleteBeforeReplace: true },
  );
};

