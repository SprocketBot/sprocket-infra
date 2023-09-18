import * as pulumi from "@pulumi/pulumi";
import * as vault from "@pulumi/vault";
import * as docker from "@pulumi/docker";
import * as postgres from "@pulumi/postgresql";

import { PostgresUser } from "../../helpers/datastore/PostgresUser";
import { ConfigFile } from "../../helpers/docker/ConfigFile";

export interface TelegrafArgs {
  configFilePath: string;
  monitoringNetworkId: docker.Network["id"];
  additionalNetworkIds: docker.Network["id"][];
  additionalEnvironmentVariables: Record<
    string,
    string | pulumi.Output<string>
  >;
  postgresHost: string | pulumi.Output<string>;
  providers: {
    vault: vault.Provider;
    postgres: postgres.Provider;
  };
  influxToken: string | pulumi.Output<string>;
}

export class Telegraf extends pulumi.ComponentResource {
  private readonly credentials: PostgresUser;
  private readonly service: docker.Service;
  private readonly config: ConfigFile;

  constructor(
    name: string,
    args: TelegrafArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("SprocketBot:Services:Telegraf", name, {}, opts);

    this.credentials = new PostgresUser(
      `${name}-pg-user`,
      {
        username: `${name}-telegraf`,
        providers: args.providers,
      },
      { parent: this },
    );

    this.config = new ConfigFile(
      `${name}-config`,
      {
        filepath: args.configFilePath,
      },
      { parent: this },
    );

    this.service = new docker.Service(
      `${name}-service`,
      {
        taskSpec: {
          containerSpec: {
            image: "telegraf:1.22-alpine",
            env: {
              ...args.additionalEnvironmentVariables,
              POSTGRES_HOST: args.postgresHost,
              POSTGRES_USER: this.credentials.username,
              POSTGRES_PASSWORD: this.credentials.password,
              HOSTNAME: "{{.Node.Hostname}}",
              INFLUX_HOSTNAME: "influx",
              INFLUX_TOKEN: args.influxToken,
            },
            configs: [
              {
                configId: this.config.id,
                configName: this.config.name,
                fileName: "/etc/telegraf/telegraf.conf",
              },
            ],
          },
          networks: [...args.additionalNetworkIds, args.monitoringNetworkId],
        },
      },
      { parent: this },
    );
  }
}
