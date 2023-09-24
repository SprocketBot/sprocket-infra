import * as pulumi from "@pulumi/pulumi";
import { buildUrn, URN_TYPE } from "@sprocketbot/infra-lib";

export class Platform extends pulumi.ComponentResource {
  constructor(name: string, args: {}, opts?: pulumi.ComponentResourceOptions) {
    super(
      buildUrn(URN_TYPE.LogicalGroup, "SprocketPlatform", name),
      name,
      {},
      opts,
    );
  }
}
