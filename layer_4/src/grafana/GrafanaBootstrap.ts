import * as pulumi from "@pulumi/pulumi"

export type GrafanaBootstrapArgs = {}

export class GrafanaBootstrap extends pulumi.ComponentResource {
  constructor(name: string, args: GrafanaBootstrapArgs, opts?: pulumi.ComponentResourceOptions) {
    super("SprocketBot:Utilities:GrafanaBootstrap", name, {});
  }
}
