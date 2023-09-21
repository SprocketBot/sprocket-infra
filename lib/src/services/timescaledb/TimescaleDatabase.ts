import * as pulumi from "@pulumi/pulumi";
import * as postgres from "@pulumi/postgresql";
import * as random from "@pulumi/random";
import { buildUrn, URN_TYPE } from "../../constants/pulumi";
import { TimescaleRole } from "./TimescaleRole";
import { Outputable } from "../../types";

export type TimescaleDatabaseArgs = {
  name: Outputable<string>;
  schemas: Record<string, { restrictedPerms: "" | "r" | "rw" }>;
  restrictedRoleAlias?: Outputable<string>;
  vaultConnName: Outputable<string>;
};

export class TimescaleDatabase extends pulumi.ComponentResource {
  readonly name: postgres.Database["name"];

  readonly root: {
    username: postgres.Role["name"];
    password: postgres.Role["password"];
  };

  constructor(
    name: string,
    args: TimescaleDatabaseArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.Database, "TimescaleDatabase"), name, {}, opts);

    const rootRole = new postgres.Role(
      "admin-role",
      {
        name: pulumi.output(args.name).apply(($dbname) => `${$dbname}-admin`),
        password: new random.RandomPassword(
          "admin-pw",
          { length: 32 },
          { parent: this },
        ).result,
        login: true,
      },
      { parent: this },
    );

    this.root = { username: rootRole.name, password: rootRole.password };

    const db = new postgres.Database(
      "db",
      {
        name: args.name,
        allowConnections: true,
        isTemplate: false,
        owner: rootRole.name,
      },
      { parent: this },
    );

    this.name = db.name;

    const restrictedRole = new TimescaleRole(
      "restricted-role",
      {
        vaultConnName: args.vaultConnName,
        name: pulumi
          .all([args.name, args.restrictedRoleAlias ?? "ro"])
          .apply(
            ([$dbname, $restrictedRoleAlias]) =>
              `${$dbname}-${$restrictedRoleAlias ?? "ro"}`,
          ),
      },
      { parent: this },
    );

    const writeRole = new TimescaleRole(
      "write-role",
      {
        vaultConnName: args.vaultConnName,
        name: pulumi.all([args.name]).apply(([$dbname]) => `${$dbname}-writer`),
      },
      { parent: this },
    );

    for (const schemaName in args.schemas) {
      if (schemaName !== "public") {
        // Create the schema
        new postgres.Schema(
          `${schemaName}-schema`,
          {
            database: db.name,
            name: schemaName,
            owner: rootRole.name,
          },
          { parent: this },
        );
      }

      const { restrictedPerms } = args.schemas[schemaName];

      if (restrictedPerms.length) {
        const usageGrant = new postgres.Grant(
          `${schemaName}-restricted-grant-usage`,
          {
            database: db.name,
            schema: schemaName,
            role: restrictedRole.pgRole.name,
            privileges: ["USAGE"],
            objectType: "schema",
          },
          { parent: this },
        );

        const tableGrant = new postgres.Grant(
          `${schemaName}-restricted-grant-tables`,
          {
            database: db.name,
            schema: schemaName,
            role: restrictedRole.pgRole.name,
            privileges: restrictedPerms.includes("w")
              ? ["SELECT", "INSERT", "UPDATE", "DELETE"]
              : ["SELECT"],
            objectType: "table",
          },
          { parent: this },
        );

        // TODO: Do we need a sequence grant?
      }

      const usageGrant = new postgres.Grant(
        `${schemaName}-write-grant-usage`,
        {
          database: db.name,
          schema: schemaName,
          role: writeRole.pgRole.name,
          privileges: ["USAGE"],
          objectType: "schema",
        },
        { parent: this },
      );

      const tableGrant = new postgres.Grant(
        `${schemaName}-write-grant-tables`,
        {
          database: db.name,
          schema: schemaName,
          role: writeRole.pgRole.name,
          privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"],
          objectType: "table",
        },
        { parent: this },
      );

      // TODO: Do we need a sequence grant?
    }
  }
}
