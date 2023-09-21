import * as grafana from "@lbrlabs/pulumi-grafana";
import * as pulumi from "@pulumi/pulumi";
import { readFileSync } from "fs";
import { compile } from "handlebars";

export type DashboardFileArgs = Omit<grafana.DashboardArgs, "configJson"> & {
  filepath: string;
  vars?: Record<string, any>;
};

export class DashboardFile extends grafana.Dashboard {
  constructor(
    name: string,
    { filepath, vars, ...args }: DashboardFileArgs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    let data: string = readFileSync(filepath).toString();

    const templated = pulumi
      .all(vars ?? {})
      .apply(($values) => compile(data, { noEscape: true })($values));
    templated.apply(console.log);

    super(name, { ...args, configJson: templated }, opts);
  }
}
