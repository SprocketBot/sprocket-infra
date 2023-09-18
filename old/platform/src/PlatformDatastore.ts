import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as vault from "@pulumi/vault";

import { RabbitMq } from "global/services/rabbitmq/RabbitMq";
import { Redis } from "global/services/redis/Redis";
import { buildHost } from "global/helpers/buildHost";
import { HOSTNAME } from "global/constants";

interface PlatformDatastoresArgs {
  ingressNetworkId: docker.Network["id"];
  vaultProvider: vault.Provider;
  platformNetworkId: docker.Network["id"];

  environmentSubdomain: string;
  configRoot: string;
}

export class PlatformDatastore extends pulumi.ComponentResource {
  readonly rabbitmq: RabbitMq;
  readonly redis: Redis;

  constructor(
    name: string,
    args: PlatformDatastoresArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("SprocketBot:Platform:Datastores", name, {}, opts);

    this.rabbitmq = new RabbitMq(
      `${name}-rmq`,
      {
        configFilepath: `${args.configRoot}/rabbitmq.conf`,
        ingressNetworkId: args.ingressNetworkId,
        platformNetworkId: args.platformNetworkId,
        url: buildHost("rabbitMq", args.environmentSubdomain, HOSTNAME),
      },
      { parent: this },
    );

    this.redis = new Redis(`${name}-redis`, {
      configFilepath: `${args.configRoot}/redis.conf`,
      vaultProvider: args.vaultProvider,
      ingressNetworkId: args.ingressNetworkId,
      platformNetworkId: args.platformNetworkId,
      url: buildHost("redis", args.environmentSubdomain, HOSTNAME),
    });
  }
}
