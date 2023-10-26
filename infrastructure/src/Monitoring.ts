import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import {
  buildUrn,
  ConfigFile,
  FluentD,
  InfluxDb,
  Loki,
  URN_TYPE,
} from "@sprocketbot/infra-lib";

export type MonitoringArgs = {
  ingressNetworkId: docker.Network["id"];
};

export class Monitoring extends pulumi.ComponentResource {
  readonly network: docker.Network;
  readonly influx: InfluxDb;
  readonly loki: Loki;

  constructor(
    name: string,
    args: MonitoringArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.LogicalGroup, "Monitoring", name), name, {}, opts);

    this.network = new docker.Network(
      "net",
      { driver: "overlay" },
      { parent: this },
    );

    this.influx = new InfluxDb(
      "influx",
      {
        exposeUi: true,
        ingressNetworkId: args.ingressNetworkId,
        monitoringNetworkId: this.network.id,
      },
      { parent: this },
    );

    this.loki = new Loki(
      "loki",
      { monitoringNetworkId: this.network.id },
      { parent: this },
    );

    const fluentConfig = new ConfigFile(
      "fluent-config",
      {
        filepath: "./src/config/fluentd.hbs.yaml",
        vars: {
          loki_hostname: this.loki.hostname,
        },
      },
      { parent: this },
    );

    const fluent = new FluentD(
      "fluent",
      {
        network: this.network.id,
        config: fluentConfig,
      },
      { parent: this },
    );
  }
}
