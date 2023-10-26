import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as random from "@pulumi/random";
import * as vault from "@pulumi/vault";
import {
  BASE_HOSTNAME,
  buildUrn,
  Outputable,
  RabbitMq,
  Redis,
  TimescaleDatabase,
  TimescaleDatabaseArgs,
  URN_TYPE,
  VaultConstants,
} from "@sprocketbot/infra-lib";
import { SprocketCore } from "./applications/core/SprocketCore";
import { z } from "zod";
import { SprocketWeb } from "./applications/web/SprocketWeb";

export type PlatformArgs = {
  vaultConnName: TimescaleDatabaseArgs["vaultConnName"];
  ingressNetworkId: docker.Network["id"];
  monitoringNetworkId: docker.Network["id"];
  postgresNetworkId: docker.Network["id"];
  postgresHostname: docker.Service["name"];
};

export class Platform extends pulumi.ComponentResource {
  readonly network: docker.Network;
  readonly redis: Redis;
  readonly rmq: RabbitMq;
  readonly database: TimescaleDatabase;

  readonly apiUrl: Outputable<string>;
  readonly webUrl: Outputable<string>;

  constructor(
    name: string,
    args: PlatformArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(
      buildUrn(URN_TYPE.LogicalGroup, "SprocketPlatform", name),
      name,
      {},
      opts,
    );

    this.network = new docker.Network(
      `${pulumi.getStack()}-network`,
      {
        driver: "overlay",
        attachable: true,
      },
      { parent: this },
    );

    this.redis = new Redis(
      "redis",
      {
        exposeInsights: true,
        ingressNetworkId: args.ingressNetworkId,
        platformNetworkId: this.network.id,
        monitoringNetworkId: args.monitoringNetworkId,
      },
      { parent: this },
    );

    this.rmq = new RabbitMq(
      "rabbitmq",
      {
        exposeManagement: true,
        ingressNetworkId: args.ingressNetworkId,
        platformNetworkId: this.network.id,
      },
      { parent: this },
    );

    this.database = new TimescaleDatabase(
      "platform-db",
      {
        name: `sprocket_${pulumi.getStack()}`,
        restrictedRoleAlias: "data_science",
        schemas: {
          data_science: { restrictedPerms: "rw" },
          mledb_bridge: { restrictedPerms: "r" },
          sprocket: { restrictedPerms: "r" },
          history: { restrictedPerms: "r" },
          mledb: { restrictedPerms: "r" },
        },
        searchPath: {
          restricted: [
            "sprocket",
            "mledb",
            "mledb_bridge",
            "history",
            "data_science",
          ],
          write: [
            "sprocket",
            "mledb",
            "mledb_bridge",
            "history",
            "data_science",
          ],
        },
        vaultConnName: args.vaultConnName,
        static: { write: true },
        exposed: { restricted: true },
      },
      { parent: this },
    );

    const services = new pulumi.ComponentResource(
      buildUrn(URN_TYPE.LogicalGroup, "PlatformServices"),
      "services",
      {},
      { parent: this },
    );

    this.apiUrl = `https://api.${BASE_HOSTNAME}`;
    this.webUrl = `https://${BASE_HOSTNAME}`;

    const jwtSecretValue = new random.RandomPassword(
      "jwt-secret",
      { length: 128 },
      { parent: this },
    );

    const jwtSecret = new docker.Secret(
      "jwt-secret-docker",
      { data: jwtSecretValue.result.apply(btoa) },
      { parent: this },
    );

    const dbPassSecret = new docker.Secret(
      "db-pass",
      {
        data: this.database.writer.pgRole.password.apply(($pw) =>
          btoa($pw ?? ""),
        ),
      },
      { parent: this },
    );

    const sprocketCore = new SprocketCore(
      "core",
      {
        db: { host: args.postgresHostname, password: dbPassSecret },
        networks: {
          ingress: args.ingressNetworkId,
          platform: this.network.id,
          db: args.postgresNetworkId,
        },
        platform: this,
        jwtSecret: jwtSecret,
      },
      { parent: services },
    );

    const sprocketWeb = new SprocketWeb(
      "web",
      {
        platform: this,
        networks: {
          ingress: args.ingressNetworkId,
          platform: this.network.id,
        },
      },
      { parent: services },
    );
  }

  getBaseConfigVars = (
    applicationName: Outputable<string>,
    applicationKey: random.RandomPet["id"],
  ) => {
    return {
      transport: pulumi
        .all([this.rmq.service.name, applicationKey, applicationName])
        .apply(([$rmqHost, $appKey, $appName]) =>
          JSON.stringify({
            url: `amqp://${$rmqHost}:5672`,
            matchmaking_queue: `${pulumi.getStack()}-matchmaking`,
            core_queue: `${pulumi.getStack()}-core`,
            bot_queue: `${pulumi.getStack()}-bot`,
            analytics_queue: `${pulumi.getStack()}-analytics`,
            events_queue: `${pulumi.getStack()}-events`,
            events_application_key: `${pulumi.getStack()}-${$appName}-${$appKey}`,
            "celery-queue": `${pulumi.getStack()}-celery`,
            image_generation_queue: `${pulumi.getStack()}-ig`,
            submission_queue: `${pulumi.getStack()}-submissions`,
            notification_queue: `${pulumi.getStack()}-notifications`,
          }),
        ),
      logger: {
        levels:
          pulumi.getStack() === "main"
            ? JSON.stringify(["error", "warn", "log"])
            : JSON.stringify(["error", "warn", "log", "debug"]),
      },
      redis: {
        port: 6379,
        host: this.redis.service.name,
        prefix: pulumi.getStack(),
      },
      rmq: {
        host: this.rmq.service.name,
      },
      frontend: { url: this.webUrl },
      api: { url: this.apiUrl },
      s3: vault.kv
        .getSecretV2Output(
          {
            name: "maintainer/manual/s3",
            mount: VaultConstants.Backend.kv2,
          },
          { parent: this },
        )
        .apply(($secret) => {
          const { data } = $secret;
          // TODO `buckets` -> `{ access, secret, name }`
          return z
            .object({
              endpoint: z.string(),
              port: z.preprocess(
                (v) => parseFloat(v as string),
                z.number().gt(0).default(80),
              ),
              ssl: z.preprocess(
                (v) => (v as string).toLowerCase() === "true",
                z.boolean().default(false),
              ),
              buckets: z.preprocess(
                (v) => {
                  return JSON.parse(
                    (v as { toString: () => string })?.toString() ?? '""',
                  );
                },
                z
                  .object({
                    replayParse: z.preprocess((v: any) => v.name, z.string()),
                    imageGeneration: z.preprocess(
                      (v: any) => v.name,
                      z.string(),
                    ),
                  })
                  .default({
                    imageGeneration: `sprocket-ig`,
                    replayParse: `sprocket-replays`,
                  })
                  .refine((d) =>
                    Object.fromEntries(
                      // Append stack name
                      Object.entries(d).map(([k, v]) => [
                        k,
                        `${v}-${pulumi.getStack()}`,
                      ]),
                    ),
                  ),
              ),
            })
            .parse(data);
        }),
    };
  };
}
