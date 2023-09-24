import * as pulumi from "@pulumi/pulumi";
import { buildUrn, URN_TYPE } from "@sprocketbot/infra-lib";

export class PlatformClients extends pulumi.ComponentResource {
  constructor(name: string, args: {}, opts?: pulumi.ComponentResourceOptions) {
    super(
      buildUrn(URN_TYPE.LogicalGroup, "SprocketPlatformClients", name),
      name,
      {},
      opts,
    );
  }
}
