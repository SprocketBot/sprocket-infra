import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import {
  NodeLabel,
  Outputable,
  URN_TYPE,
  buildUrn,
} from "@sprocketbot/infra-lib";
import type { Platform } from "../Platform";
import { RoleRestriction } from "@sprocketbot/infra-lib/bin/src/constants/docker-node-labels";
export type SprocketServiceArgs = {
  image: {
    namespace: string;
    repository: string;
    tag: string;
  };
  networks?: {
    ingress?: docker.Network["id"];
    additional?: docker.Network["id"][];
  };
  instanceCount?: Outputable<number>;
  platform: Platform;
  allowedRoles?: NodeLabel.Role[];
};
export class SprocketService extends pulumi.ComponentResource {
  readonly service: docker.Service;

  constructor(
    name: string,
    args: SprocketServiceArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.Service, "SprocketService", name), name, {}, opts);

    const networks: docker.types.input.ServiceTaskSpecNetworksAdvanced[] = [];
    if (args.networks.ingress) {
      networks.push({ name: args.networks.ingress });
    }

    this.service = new docker.Service(
      `${name}-service`,
      {
        taskSpec: {
          containerSpec: {
            // TODO: We need to fetch SHA hashes to prevent this from changing itself without cause
            image: `${args.image.namespace}/${args.image.repository}:${args.image.tag}`,
            env: {
              NODE_ENV: "production",
            },
          },
          placement: {
            maxReplicas: args.instanceCount ?? 2,
            constraints: args.allowedRoles?.map((role) =>
              RoleRestriction(role),
            ),
          },
          networksAdvanceds: networks,
        },
      },
      { parent: this },
    );
  }
}
