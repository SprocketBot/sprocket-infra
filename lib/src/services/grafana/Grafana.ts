import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as random from "@pulumi/random";
import * as vault from "@pulumi/vault";
import {
  VaultConstants,
  BASE_HOSTNAME,
  buildUrn,
  URN_TYPE,
  CertResolver,
} from "../../constants";
import { TimescaleDatabase } from "../timescaledb";
import { Role, RoleRestriction } from "../../constants/docker-node-labels";
import {
  ConfigFile,
  ConfigFileArgs,
  LogDriver,
  ServiceCategory,
  TraefikHttpLabel,
  UrlAvailable,
  UserPassCredential,
  VaultUtils,
} from "../../utils";
import { Outputable } from "../../types";

import * as grafana from "@lbrlabs/pulumi-grafana";

export type GrafanaConfigVars = {
  name: Outputable<string>;
  hostname: Outputable<string>;
  db: Outputable<{
    host: Outputable<string>;
    name: Outputable<string>;
    user: Outputable<string>;
    password: Outputable<string>;
  }>;
  admin: Outputable<{
    username: Outputable<string>;
    password: Outputable<string>;
  }>;
  discord_oauth: Outputable<{
    client_id: Outputable<string>;
    client_secret: Outputable<string>;
    auth_url: Outputable<string>;
    guild_id: Outputable<string>;
  }>;
  github_oauth: Outputable<{
    client_id: Outputable<string>;
    client_secret: Outputable<string>;
  }>;
  smtp: Outputable<{
    host: Outputable<string>;
    from: Outputable<string>;
    name: Outputable<string>;
    password: Outputable<string>;
    username: Outputable<string>;
  }>;
};

export type GrafanaArgs = {
  networks: {
    monitoring: docker.Network["id"];
    ingress: docker.Network["id"];
    postgres: docker.Network["id"];
  };
  pg: {
    hostname: docker.Service["name"];
    vaultConnName: vault.database.SecretBackendConnection["name"];
  };
  configFilePath: ConfigFileArgs["filepath"];
  configFileVars: Omit<GrafanaConfigVars, "name" | "hostname" | "db" | "admin">;

  outputHackVars?: pulumi.Output<unknown[]>;
};

export class Grafana extends pulumi.ComponentResource {
  readonly hostname: Outputable<string>;
  readonly provider: grafana.Provider;
  readonly adminCreds: UserPassCredential;

  constructor(
    name: string,
    args: GrafanaArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.Service, "Grafana"), name, {}, opts);
    const uid = new random.RandomPet(
      "uid",
      { prefix: "grafana" },
      { parent: this },
    );

    const db = new TimescaleDatabase(
      "db",
      {
        name: uid.id,
        vaultConnName: args.pg.vaultConnName,
        schemas: { public: { restrictedPerms: "" } },
      },
      { parent: this },
    );

    const hostname = `grafana.${BASE_HOSTNAME}`;
    this.hostname = hostname;

    this.adminCreds = new UserPassCredential(
      "admin-creds",
      {
        path: {
          name: "sudo/generated/grafana/root-user",
          mount: VaultConstants.Backend.kv2,
        },
      },
      { parent: this },
    );

    const configFile = new ConfigFile(
      "grafana-config",
      {
        filepath: args.configFilePath,
        vars: {
          ...args.configFileVars,
          name: uid.id.apply(($id) => `Sprocket Grafana (${$id})`),
          hostname: hostname,
          admin: {
            username: this.adminCreds.username,
            password: this.adminCreds.password,
          },
          db: {
            host: args.pg.hostname,
            name: db.name,
            username: db.root.username,
            password: db.root.password,
          },
        },
      },
      { parent: this },
    );

    const service = new docker.Service(
      "grafana-service",
      {
        taskSpec: {
          containerSpec: {
            image:
              "grafana/grafana:main@sha256:0bfbb3c135707984fbdf165ca6a9effef8a0f136be76759fd3de52161c31a79d",
            configs: [
              {
                configName: configFile.name,
                configId: configFile.id,
                fileName: "/etc/grafana/grafana.ini", // https://grafana.com/docs/grafana/latest/setup-grafana/configure-docker/#default-paths
              },
            ],
            env: {
              GF_INSTALL_PLUGINS:
                "grafana-github-datasource,grafana-polystat-panel,redis-datasource,",
            },
          },
          placement: {
            constraints: [RoleRestriction(Role.INGRESS, true)],
            platforms: [{ architecture: "amd64", os: "linux" }],
          },
          logDriver: LogDriver("grafana", ServiceCategory.MONITORING),
          networksAdvanceds: Object.values(args.networks).map(($nid) => ({
            name: $nid,
          })),
        },
        labels: new TraefikHttpLabel(name)
          .rule(`Host(\`${hostname}\`)`)
          .tls(CertResolver.DNS)
          .targetPort(3000).complete,
      },
      { parent: this },
    );

    this.provider = new grafana.Provider(
      "grafana-provider",
      {
        url: UrlAvailable(`https://${hostname}`),
        auth: pulumi
          .all([this.adminCreds.username, this.adminCreds.password])
          .apply(([$user, $pass]) => `${$user}:${$pass}`),
      },
      { parent: this },
    );
  }
}
