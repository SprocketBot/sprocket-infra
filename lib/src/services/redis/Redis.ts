import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as grafana from "@lbrlabs/pulumi-grafana";
import { BASE_HOSTNAME, buildUrn, EntryPoint, URN_TYPE } from "../../constants";
import {
  ConfigFile,
  LogDriver,
  ServiceCategory,
  TraefikHttpLabel,
} from "../../utils";

type ExposedRedisArgs = {
  exposeInsights: true;
  ingressNetworkId: docker.Network["id"];
};

export type RedisArgs = {
  config?: ConfigFile;
  platformNetworkId: docker.Network["id"];
  monitoringNetworkId: docker.Network["id"];
} & ({ exposeInsights?: false } | ExposedRedisArgs);

export class Redis extends pulumi.ComponentResource {
  readonly service: docker.Service;

  constructor(
    name: string,
    args: RedisArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.Database, "Redis"), name, {}, opts);

    this.service = new docker.Service(
      `${name}-service-${pulumi.getStack()}`,
      {
        taskSpec: {
          containerSpec: {
            // https://redis.io/docs/about/about-stack/
            image: args.exposeInsights
              ? "redis/redis-stack:7.2.0-v2@sha256:0fd846a82510599984e34d886e610ec3a775d91a0dbb4d2c89aa394e39fa4af7"
              : "redis/redis-stack-server:7.2.0-v2",
            configs: [
              args.config
                ? {
                    configId: args.config.id,
                    configName: args.config.name,
                    fileName: "/redis-stack.conf",
                  }
                : null,
            ].filter(
              Boolean,
            ) as docker.types.input.ServiceTaskSpecContainerSpecConfig[],
          },
          logDriver: LogDriver(name, ServiceCategory.UTILITY),
          networksAdvanceds: [
            ...(args.exposeInsights ? [{ name: args.ingressNetworkId }] : []),
            { name: args.platformNetworkId },
            { name: args.monitoringNetworkId },
          ],
        },
        labels: args.exposeInsights
          ? new TraefikHttpLabel(name)
              .targetPort(8001)
              // TODO: How would this work if we chose to expose more than one redis?
              // This applies to many other things
              .rule(`Host(\`insights.redis.${BASE_HOSTNAME}\`)`)
              .tls("lets-encrypt-tls")
              .entryPoints(EntryPoint.HTTPS).complete
          : [],
      },
      { parent: this },
    );

    new grafana.DataSource(
      `${name}-datasource`,
      {
        name: `${name}-${pulumi.getStack()}`,
        type: "redis-datasource",
        url: this.service.name.apply(
          ($hostname) => `redis://${$hostname}:6379`,
        ), // TODO: Password?
      },
      { parent: this },
    );
  }
}
