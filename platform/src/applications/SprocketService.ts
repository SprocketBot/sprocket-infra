import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as vault from "@pulumi/vault";

import {
  buildUrn,
  CertResolver,
  EntryPoint,
  getImageSha,
  LogDriver,
  NodeLabel,
  Outputable,
  ServiceCategory,
  TraefikHttpLabel,
  URN_TYPE,
  VaultConstants,
} from "@sprocketbot/infra-lib";
import type { Platform } from "../Platform";

export type SprocketServiceArgs = {
  image: {
    namespace: string;
    repository: string;
    tag: string;
  };
  networks: {
    platform: docker.Network["id"];
    ingress?: docker.Network["id"];
    additional?: docker.Network["id"][];
  };
  instanceCount?: Outputable<number>;
  platform: Platform;
  allowedRoles?: NodeLabel.Role[];
  secrets?: Outputable<
    Outputable<docker.types.input.ServiceTaskSpecContainerSpecSecret>[]
  >;
  configs?: Outputable<
    Outputable<docker.types.input.ServiceTaskSpecContainerSpecConfig>[]
  >;
  env?: Record<string, Outputable<string>>;
} & (
  | {
      url: string;
      innerPort: number;
      networks: {
        ingress: docker.Network["id"];
      };
    }
  | { url?: undefined | never; networks?: { ingress?: never } }
);
export class SprocketService extends pulumi.ComponentResource {
  readonly service: docker.Service;

  constructor(
    name: string,
    args: SprocketServiceArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.Service, "SprocketService", name), name, {}, opts);

    const networks: docker.types.input.ServiceTaskSpecNetworksAdvanced[] = [
      { name: args.networks.platform },
    ];
    if (args.networks?.ingress) {
      networks.push({ name: args.networks.ingress });
    }

    const dockerAuthSecret = vault.kv.getSecretV2Output(
      {
        name: "maintainer/manual/docker-auth",
        mount: VaultConstants.Backend.kv2,
      },
      {
        parent: this,
      },
    );

    this.service = new docker.Service(
      `${pulumi.getStack()}-${name}-service`,
      {
        auth: dockerAuthSecret.data.apply(($data) => ({
          username: $data.username,
          password: $data.password,
          serverAddress: $data.serverAddress ?? "hub.docker.com",
        })),
        labels: [
          ...("url" in args && "innerPort" in args
            ? new TraefikHttpLabel(`${pulumi.getStack()}-${name}-http`)
                .rule(`Host(\`${new URL(`http://${args.url!}`).host}\`)`)
                .tls(CertResolver.DNS)
                .targetPort(args.innerPort)
                .entryPoints(EntryPoint.HTTPS).complete
            : []),
        ],
        taskSpec: {
          containerSpec: {
            image: getImageSha(
              args.image.namespace,
              args.image.repository,
              args.image.tag,
              dockerAuthSecret.data.apply(($data) => ({
                username: $data.username as string,
                password: $data.password as string,
              })),
            ),
            env: {
              NODE_ENV: "production",
              ...args.env,
            },
            secrets:
              // Unwrap potentially nested secrets
              pulumi
                .output(args.secrets ?? [])
                .apply(($secrets) => pulumi.all($secrets)),
            configs:
              // Unwrap potentially nested configs
              pulumi
                .output(args.configs ?? [])
                .apply(($configs) => pulumi.all($configs)),
          },
          logDriver: LogDriver(
            `${args.image.repository}:${args.image.tag}`,
            ServiceCategory.PLATFORM,
          ),
          placement: {
            maxReplicas: args.instanceCount ?? 2,
            constraints: args.allowedRoles?.map((role) =>
              NodeLabel.RoleRestriction(role),
            ),
            platforms: [
              {
                architecture: "amd64",
                os: "linux",
              },
            ],
          },

          networksAdvanceds: networks,
        },
      },
      { parent: this },
    );
  }
}
