import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import {
  buildUrn,
  RabbitMq,
  Redis,
  TimescaleDatabase,
  TimescaleDatabaseArgs,
  URN_TYPE,
} from "@sprocketbot/infra-lib";

export type PlatformArgs = {
  vaultConnName: TimescaleDatabaseArgs["vaultConnName"];
  ingressNetworkId: docker.Network["id"];
  monitoringNetworkId: docker.Network["id"];
  // TODO: Accept Redis
  // TODO: Accept RMQ
};

export class Platform extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: PlatformArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(
      buildUrn(URN_TYPE.LogicalGroup, "SprocketPlatform", name),
      name,
      {},
      opts,
    );

    const network = new docker.Network(
      `${pulumi.getStack()}-network`,
      {
        driver: "overlay",
      },
      { parent: this },
    );

    const redis = new Redis(
      "redis",
      {
        exposeInsights: true,
        ingressNetworkId: args.ingressNetworkId,
        platformNetworkId: network.id,
        monitoringNetworkId: args.monitoringNetworkId,
      },
      { parent: this },
    );

    const rmq = new RabbitMq(
      "rabbitmq",
      {
        exposeManagement: true,
        ingressNetworkId: args.ingressNetworkId,
        platformNetworkId: network.id,
      },
      { parent: this },
    );

    const database = new TimescaleDatabase(
      "platform-db",
      {
        name: `sprocket_${pulumi.getStack()}`,
        restrictedRoleAlias: "data_science",
        schemas: {
          data_science: { restrictedPerms: "rw" },
          mledb_bridge: { restrictedPerms: "r" },
          sprocket: { restrictedPerms: "r" },
          history: { restrictedPerms: "r" },
          mledb: { restrictedPerms: "r" },
        },
        searchPath: {
          restricted: ["sprocket","mledb","mledb_bridge","history","data_science"],
          write: ["sprocket","mledb","mledb_bridge","history","data_science"],
        },
        vaultConnName: args.vaultConnName,
        static: { write: true },
      },
      { parent: this },
    );
  }
}
