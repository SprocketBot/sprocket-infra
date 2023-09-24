// TODO: Main API Service
// TODO: Workers (Replicas, constrain to compute)
// TODO: Write a couple custom resources for things like Prefect Blocks (e.g. Discord Webhooks, Database credentials (?))

import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import { BASE_HOSTNAME, buildUrn, EntryPoint, URN_TYPE } from "../../constants";
import { TimescaleDatabase } from "../timescaledb";
import { Outputable } from "../../types";
import { LogDriver, ServiceCategory, TraefikHttpLabel } from "../../utils";

export type PrefectArgs = {
  pg: {
    vaultConnName: Outputable<string>;
    networkId: Outputable<string>;
    hostname: Outputable<string>;
    port: Outputable<string | number>;
  };
  ingress: { networkId: Outputable<string> };
  envs?: docker.types.input.ServiceTaskSpecContainerSpec["env"];
};

export class Prefect extends pulumi.ComponentResource {
  private readonly db: TimescaleDatabase;

  readonly service: docker.Service;
  readonly worker: docker.Service;
  readonly network: docker.Network;

  constructor(
    name: string,
    args: PrefectArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.Invalid, "Prefect"), name, {}, opts);
    this.db = new TimescaleDatabase(
      "prefect-db",
      {
        name: `${name}-db`,
        schemas: { public: { restrictedPerms: "" } },
        vaultConnName: args.pg.vaultConnName,
      },
      { parent: this },
    );

    this.network = new docker.Network(
      "prefect-net",
      { driver: "overlay" },
      { parent: this },
    );

    const hostname = `prefect.${BASE_HOSTNAME}`;

    this.service = new docker.Service(
      "prefect-service",
      {
        taskSpec: {
          containerSpec: {
            image: "prefecthq/prefect:2-latest", // TODO: SHA,
            commands:
              "prefect server start --host 0.0.0.0 --port 4200 --analytics-off --ui".split(
                " ",
              ),
            env: {
              ...args.envs,
              PREFECT_API_URL: `https://${hostname}/api`,
              PREFECT_API_DATABASE_CONNECTION_URL: pulumi
                .all([
                  this.db.name,
                  this.db.root.username,
                  this.db.root.password,
                  args.pg.hostname,
                  args.pg.port,
                ])
                .apply(
                  ([$db, $user, $pass, $host, $port]) =>
                    `postgresql+asyncpg://${$user}:${$pass}@${$host}:${$port}/${$db}`,
                ),
            },
          },
          logDriver: LogDriver("Prefect", ServiceCategory.DATA_TOOL),
          networksAdvanceds: [
            { name: args.pg.networkId },
            { name: args.ingress.networkId },
            { name: this.network.id },
          ],
        },
        labels: new TraefikHttpLabel(name)
          .targetPort(4200)
          .rule(`Host(\`${hostname}\`)`)
          .entryPoints(EntryPoint.HTTPS)
          .tls("lets-encrypt-tls").complete,
      },
      { parent: this },
    );

    this.worker = new docker.Service(
      "prefect-worker",
      {
        taskSpec: {
          containerSpec: {
            image: "prefecthq/prefect:2-latest", // TODO: SHA,
            commands:
              "prefect worker start --pool worker-pool --work-queue default".split(
                " ",
              ),
            env: {
              ...args.envs,
              PREFECT_API_URL: this.service.name.apply(
                ($name) => `http://${$name}:4200/api`,
              ),
              PREFECT_API_DATABASE_CONNECTION_URL: pulumi
                .all([
                  this.db.name,
                  this.db.root.username,
                  this.db.root.password,
                  args.pg.hostname,
                  args.pg.port,
                ])
                .apply(
                  ([$db, $user, $pass, $host, $port]) =>
                    `postgresql+asyncpg://${$user}:${$pass}@${$host}:${$port}/${$db}`,
                ),
            },
          },
          logDriver: LogDriver("prefect", ServiceCategory.DATA_TOOL),
          networksAdvanceds: [
            { name: args.pg.networkId },
            { name: this.network.id },
          ],
        },
      },
      { parent: this },
    );
  }
}
