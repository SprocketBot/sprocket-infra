import * as pulumi from "@pulumi/pulumi";
import * as postgres from "@pulumi/postgresql";
import * as random from "@pulumi/random";
import { buildUrn, URN_TYPE } from "../../constants/pulumi";
import { TimescaleRole } from "./TimescaleRole";
import { Outputable } from "../../types";
import * as grafana from "@lbrlabs/pulumi-grafana";
import {
  InfrastructureStackOutputs,
  InfrastructureStackRef,
} from "../../stack-refs";

export type TimescaleDatabaseArgs = {
  name: Outputable<string>;
  schemas: Record<
    string,
    { restrictedPerms: "" | "r" | "rw"; restrictedOwns?: boolean }
  >;
  restrictedRoleAlias?: Outputable<string>;
  vaultConnName: Outputable<string>;
  searchPath?: { restricted?: Outputable<string[]>; write?: Outputable<string[]> };
  static?: { restricted?: boolean; write?: boolean };
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
          { length: 32, special: false },
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

    // TODO: Can we just use a default permissions on this to simplify the grants?

    const restrictedRole = new TimescaleRole(
      "restricted-role",
      {
        vaultConnName: args.vaultConnName,
        name: pulumi
          .all([args.name, args.restrictedRoleAlias ?? "ro"])
          .apply(
            ([$dbname, $restrictedRoleAlias]) =>
              `${$dbname}_${$restrictedRoleAlias ?? "ro"}`,
          ),
        searchPath: args.searchPath?.restricted,
        static: args.static?.restricted,
        canLogIn: true,
      },
      { parent: this },
    );

    const grafanaProvider = this.getProvider("grafana::") as grafana.Provider;

    // We don't connect if there isn't a grafana provider, or we are in the infra space
    if (grafanaProvider.auth && InfrastructureStackRef) {
      new grafana.DataSource(
        `${name}-${pulumi.getStack()}`,
        {
          name: `${name}-${pulumi.getStack()}`,
          type: "postgres",
          url: pulumi
            .all([
              InfrastructureStackRef?.getOutput(
                InfrastructureStackOutputs.PostgresInternalHostname,
              ),
            ])
            .apply(([$host]) => `${$host}:5432`),
          username: restrictedRole.pgRole.name,
          jsonDataEncoded: db.name.apply(($dbName) =>
            JSON.stringify({
              timescaledb: true,
              sslmode: "disable",
              database: $dbName,
            }),
          ),
          secureJsonDataEncoded: restrictedRole.pgRole.password.apply(($pass) =>
            JSON.stringify({
              password: $pass,
            }),
          ),
        },
        { parent: this },
      );
    }

    const writeRole = new TimescaleRole(
      "write-role",
      {
        vaultConnName: args.vaultConnName,
        name: pulumi.all([args.name]).apply(([$dbname]) => `${$dbname}`),
        searchPath: args.searchPath?.write,
        static: args.static?.write,
      },
      { parent: this },
    );

    new postgres.Extension(
      "timescale-ext",
      {
        name: "timescaledb",
        database: db.name,
      },
      { parent: this },
    );

    new postgres.Extension(
      "trigram-ext",
      {
        name: "pg_trgm",
        database: db.name,
      },
      { parent: this },
    );

    new postgres.Extension(
      "uuid-ext",
      {
        name: "uuid-ossp",
        database: db.name,
      },
      { parent: this },
    );

    for (const schemaName in args.schemas) {
      const schemaComponent = new pulumi.ComponentResource(
        buildUrn(URN_TYPE.LogicalGroup, "DatabaseSchema"),
        schemaName,
        {},
        { parent: this },
      );

      let schemaNameOutput = pulumi.output(schemaName);

      if (schemaName !== "public") {
        // Create the schema
        const createdSchema = new postgres.Schema(
          `${schemaName}-schema`,
          {
            database: db.name,
            name: schemaName,
            owner: args.schemas[schemaName].restrictedOwns
              ? restrictedRole.pgRole.name
              : rootRole.name,
          },
          { parent: schemaComponent, dependsOn: [rootRole] },
        );
        schemaNameOutput = createdSchema.name;
      }

      const { restrictedPerms } = args.schemas[schemaName];

      if (restrictedPerms.length) {
        const usageGrant = new postgres.Grant(
          `${schemaName}-restricted-grant-usage`,
          {
            database: db.name,
            schema: schemaNameOutput,
            role: restrictedRole.pgRole.name,
            privileges: restrictedPerms.includes("w")
                ? ["CREATE", "USAGE"]
                : ["USAGE"],
            objectType: "schema",
          },
          { parent: schemaComponent, dependsOn: [restrictedRole] },
        );

        const tableGrant = new postgres.Grant(
          `${schemaName}-restricted-grant-tables`,
          {
            database: db.name,
            schema: schemaNameOutput,
            role: restrictedRole.pgRole.name,
            privileges: restrictedPerms.includes("w")
              ? ["SELECT", "INSERT", "UPDATE", "DELETE"]
              : ["SELECT"],
            objectType: "table",
          },
          { parent: schemaComponent, dependsOn: [restrictedRole] },
        );

        // TODO: Do we need a sequence grant?
      }

      const usageGrant = new postgres.Grant(
        `${schemaName}-write-grant-usage`,
        {
          database: db.name,
          schema: schemaNameOutput,
          role: writeRole.pgRole.name,
          privileges: ["CREATE", "USAGE"],
          objectType: "schema",
        },
        { parent: schemaComponent, dependsOn: [writeRole] },
      );

      const tableGrant = new postgres.Grant(
        `${schemaName}-write-grant-tables`,
        {
          database: db.name,
          schema: schemaNameOutput,
          role: writeRole.pgRole.name,
          privileges: ["ALL"],
          objectType: "table",
        },
        { parent: schemaComponent, dependsOn: [writeRole] },
      );

      // TODO: Do we need a sequence grant?
    }
  }
}
