import * as docker from "@pulumi/docker";
import * as pulumi from "@pulumi/pulumi";
import { readFileSync } from "fs";
import { compile } from "handlebars";

export type ConfigFileArgs = Omit<docker.ServiceConfigArgs, "data"> & {
  filepath: string;
  vars?: Record<string, any>;
};

export class ConfigFile extends docker.ServiceConfig {
  constructor(
    name: string,
    { filepath, vars, ...args }: ConfigFileArgs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    let data: string = readFileSync(filepath).toString();

    const templated = pulumi
      .all(vars ?? {})
      .apply((v) => compile(data, { noEscape: true })(v));

    super(
      name,
      {
        ...args,
        data: templated.apply(btoa),
      },
      opts,
    );
  }
}
