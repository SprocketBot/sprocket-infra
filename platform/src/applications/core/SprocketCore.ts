import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as random from "@pulumi/random";
import { SprocketService, SprocketServiceArgs } from "../SprocketService";
import {
  buildUrn,
  ConfigFile,
  Outputable,
  URN_TYPE,
  vaultPathToDockerSecrets,
  VaultConstants,
  BASE_HOSTNAME,
} from "@sprocketbot/infra-lib";

export type SprocketCoreArgs = Omit<
  SprocketServiceArgs,
  "image" | "networks"
> & {
  networks: {
    ingress: docker.Network["id"];
    platform: docker.Network["id"];
    db: docker.Network["id"];
    additional?: docker.Network["id"][];
  };
  configFilePath?: Outputable<string>;
  db: {
    host: Outputable<string>;
    port?: number;
    password: docker.Secret;
  };
  jwtSecret: docker.Secret;
};

export class SprocketCore extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: SprocketCoreArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.Service, "SprocketCore", name), name, {}, opts);

    const appKey = new random.RandomPet("appKey", {}, { parent: this });

    const config = new ConfigFile(
      `${name}-config`,
      {
        filepath: `${__dirname}/core.hbs.json`,
        vars: {
          ...args.platform.getBaseConfigVars("core", appKey.id),
          database: {
            host: args.db.host,
            port: args.db.port ?? 5432,
            username: args.platform.database.writer.pgRole.name,
            database: args.platform.database.name,
            enable_logs: pulumi.getStack() !== "main",
          },
        },
      },
      { parent: this },
    );

    const service = new SprocketService(
      name,
      {
        ...args,
        innerPort: 3001,
        configs: [
          {
            configId: config.id,
            configName: config.name,
            fileName: args.configFilePath ?? "/app/config/production.json",
          },
        ],
        image: {
          namespace: "actualsovietshark",
          repository: "core",
          tag: pulumi.getStack(),
        },
        networks: {
          ingress: args.networks.ingress,
          platform: args.networks.platform,
          additional: [args.networks.db, ...(args.networks.additional ?? [])],
        },
        url: `api.${BASE_HOSTNAME}`,
        secrets: this.getSecrets().apply(($platformSecrets) => [
          ...$platformSecrets,
          {
            fileName: "/app/secret/jwtSecret.txt",
            secretId: args.jwtSecret.id,
            secretName: args.jwtSecret.name,
          },
          {
            fileName: "/app/secret/redis-password.txt",
            secretId: args.platform.redis.passwordSecret.id,
            secretName: args.platform.redis.passwordSecret.name,
          },
          {
            fileName: "/app/secret/db-password.txt",
            secretId: args.db.password.id,
            secretName: args.db.password.name,
          },
        ]),
      },
      { parent: this },
    );
  }

  protected getSecrets(): pulumi.Output<
    docker.types.input.ServiceTaskSpecContainerSpecSecret[]
  > {
    const minioSecrets = pulumi
      .output(
        vaultPathToDockerSecrets(
          "maintainer/manual/s3",
          VaultConstants.Backend.kv2,
          ["access", "secret"],
          this,
        ),
      )
      .apply(($secrets) => [
        {
          fileName: "/app/secret/minio-access.txt",
          secretId: $secrets["access"].id,
          secretName: $secrets["access"].name,
        },
        {
          fileName: "/app/secret/minio-secret.txt",
          secretId: $secrets["secret"].id,
          secretName: $secrets["secret"].name,
        },
      ]);

    const platformSecrets = pulumi.output(
      vaultPathToDockerSecrets(
        "maintainer/manual/platform-oauths",
        VaultConstants.Backend.kv2,
        [
          "epic-client-id",
          "epic-secret-id",
          "google-client-id",
          "google-secret-id",
          "microsoft-client-id",
          "microsoft-secret-id",
          "steam-key",
        ],
        this,
      ).then<docker.types.input.ServiceTaskSpecContainerSpecSecret[]>(
        ($secrets) => [
          {
            fileName: "/app/secret/epic-client.txt",
            secretId: $secrets["epic-client-id"].id,
            secretName: $secrets["epic-client-id"].name,
          },
          {
            fileName: "/app/secret/epic-secret.txt",
            secretId: $secrets["epic-secret-id"].id,
            secretName: $secrets["epic-secret-id"].name,
          },
          {
            fileName: "/app/secret/googleClientId.txt",
            secretId: $secrets["google-client-id"].id,
            secretName: $secrets["google-client-id"].name,
          },
          {
            fileName: "/app/secret/googleSecret.txt",
            secretId: $secrets["google-secret-id"].id,
            secretName: $secrets["google-secret-id"].name,
          },
          {
            fileName: "/app/secret/microsoft-client-id.txt",
            secretId: $secrets["microsoft-client-id"].id,
            secretName: $secrets["microsoft-client-id"].name,
          },
          {
            fileName: "/app/secret/microsoft-secret.txt",
            secretId: $secrets["microsoft-secret-id"].id,
            secretName: $secrets["microsoft-secret-id"].name,
          },
          {
            fileName: "/app/secret/steam-key.txt",
            secretId: $secrets["steam-key"].id,
            secretName: $secrets["steam-key"].name,
          },
        ],
      ),
    );
    const discordOauth = pulumi
      .output(
        vaultPathToDockerSecrets(
          "maintainer/manual/discord-oauth",
          VaultConstants.Backend.kv2,
          ["client_id", "client_secret"],
          this,
        ),
      )
      .apply(($secrets) => [
        {
          fileName: "/app/secret/discord-client.txt",
          secretId: $secrets["client_id"].id,
          secretName: $secrets["client_id"].name,
        },
        {
          fileName: "/app/secret/discord-secret.txt",
          secretId: $secrets["client_secret"].id,
          secretName: $secrets["client_secret"].name,
        },
      ]);

    return pulumi
      .all([platformSecrets, discordOauth, minioSecrets])
      .apply((values) => values.flat());
  }
}
