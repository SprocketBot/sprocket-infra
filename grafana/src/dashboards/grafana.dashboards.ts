import * as grafana from "@lbrlabs/pulumi-grafana";
import * as pulumi from "@pulumi/pulumi";

import * as fs from "fs";

import { buildUrn, Outputable, URN_TYPE } from "@sprocketbot/infra-lib";
import path = require("path");

import { DashboardFile } from "./DashboardFile";
import { BuildGrafanaDatasources } from "../grafana.datasources";

export type GrafanaDashboardsArgs = {
  targetPath?: string;
  datasources: ReturnType<typeof BuildGrafanaDatasources>;
};
export class GrafanaDashboards extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: GrafanaDashboardsArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(
      buildUrn(URN_TYPE.LogicalGroup, "GrafanaDashboards", name),
      name,
      {},
      opts,
    );
    const { targetPath = __dirname, datasources } = args;

    const dirContent = fs.readdirSync(targetPath, { withFileTypes: true });

    const mappedSources = Object.entries(datasources).reduce<
      Record<
        string,
        Outputable<{
          uid: Outputable<string>;
          name: Outputable<string>;
          type: Outputable<string>;
        }>
      >
    >((a, [k, v]: [string, grafana.DataSource]) => {
      a[k] = pulumi
        .all([v.name, v.uid, v.type])
        .apply(([$name, $uid, $type]) => ({
          name: $name,
          uid: $uid,
          type: $type,
        }));
      return a;
    }, {});

    for (const content of dirContent) {
      if (content.isDirectory()) {
        new GrafanaDashboards(
          `${name}-${content.name}`,
          { ...args, targetPath: path.join(targetPath, content.name) },
          { ...opts, parent: this },
        );
      } else if (content.name.endsWith(".json")) {
        const t = new DashboardFile(
          `${name}-$dashboard-${content.name
            .split(".")
            .slice(0, -1)
            .join("-")}`,
          {
            overwrite: true,
            filepath: path.join(targetPath, content.name),
            vars: mappedSources,

            // TODO: Populate this with:
            // - Data Sources
            // - Alert Sources?
          },
          { parent: this },
        );

        t.configJson.apply(console.log);
      }
    }
  }
}
