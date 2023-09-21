import * as pulumi from "@pulumi/pulumi";
import { URN_TYPE, buildUrn } from "@sprocketbot/infra-lib";

export class GrafanaPanels extends pulumi.ComponentResource {
  constructor(name: string, args: {}, opts?: pulumi.ComponentResourceOptions) {
    super(
      buildUrn(URN_TYPE.LogicalGroup, "GrafanaPanels", name),
      name,
      {},
      opts,
    );
  }
}
