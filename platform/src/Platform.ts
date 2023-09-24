import * as pulumi from "@pulumi/pulumi";
import {
  buildUrn,
  TimescaleDatabase,
  TimescaleDatabaseArgs,
  URN_TYPE,
} from "@sprocketbot/infra-lib";

export type PlatformArgs = {
  vaultConnName: TimescaleDatabaseArgs["vaultConnName"];
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
          restricted: "sprocket,mledb,mledb_bridge,history,data_science",
          write: "sprocket,mledb,mledb_bridge,history,data_science",
        },
        vaultConnName: args.vaultConnName,
        static: { write: true },
      },
      { parent: this },
    );
  }
}
