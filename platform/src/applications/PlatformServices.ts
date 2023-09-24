import * as pulumi from "@pulumi/pulumi";
import { buildUrn, URN_TYPE } from "@sprocketbot/infra-lib";

export class PlatforServices extends pulumi.ComponentResource {
  constructor(name: string, args: {}, opts?: pulumi.ComponentResourceOptions) {
    super(
      buildUrn(URN_TYPE.LogicalGroup, "SprocketPlatforServices", name),
      name,
      {},
      opts,
    );
  }
}
