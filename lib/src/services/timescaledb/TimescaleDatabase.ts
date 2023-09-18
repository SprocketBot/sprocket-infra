import * as pulumi from "@pulumi/pulumi"
import * as postgres from "@pulumi/postgresql";
import * as vault from "@pulumi/vault";
import {buildUrn, URN_TYPE} from "../../constants/pulumi";
import {UserPassCredential} from "../../utils";
import {Backend} from "../vault/backends";
import {TimescaleRole} from "./TimescaleRole";

export type TimescaleDatabaseArgs = {
    dbname: Outputable<string>,
    schemas: Record<string, { restrictedPerms: "" | "r" | "rw" }>,
    restrictedRoleAlias?: Outputable<string>,
    vault: {
        connection: vault.database.SecretBackendConnection,
    }
}

export class TimescaleDatabase extends pulumi.ComponentResource {
    constructor(name: string, args: TimescaleDatabaseArgs, opts?: pulumi.ComponentResourceOptions) {
        super(buildUrn(URN_TYPE.Database, "TimescaleDatabase"), name, {}, opts)

        const rootRole = new postgres.Role("admin-role", {
            name: pulumi.output(args.dbname).apply($dbname => `${$dbname}-admin`),
            login: true,
        }, {parent: this})

        const db = new postgres.Database("db", {
            name: args.dbname,
            allowConnections: true,
            isTemplate: false,
            owner: rootRole.name
        }, {parent: this})

        const restrictedRole = new TimescaleRole("restricted-role", {
            dbName: db.name,
            vaultConnName: args.vault.connection.name,
            name: pulumi.all([args.dbname, args.restrictedRoleAlias ?? ""]).apply(([$dbname, $restrictedRoleAlias]) => `${$dbname}-${$restrictedRoleAlias ?? "ro"}`),
        }, {parent: this})

        const writeRole = new TimescaleRole("write-role", {
            dbName: db.name,
            vaultConnName: args.vault.connection.name,
            name: pulumi.all([args.dbname]).apply(([$dbname]) => `${$dbname}-writer`),
        }, {parent: this})


        for (const schemaName in args.schemas) {
            const schema = new postgres.Schema(`${schemaName}-schema`, {
                database: db.name,
                name: schemaName,
                owner: rootRole.name,
            }, {parent: this})

            const {restrictedPerms} = args.schemas[schemaName]

            if (restrictedPerms.length) {
                const usageGrant = new postgres.Grant(`${schemaName}-restricted-grant-usage`, {
                    database: db.name,
                    schema: schema.name,
                    role: restrictedRole.pgRole.name,
                    privileges: ["usage"],
                    objectType: "schema"
                }, {parent: this})

                const tableGrant = new postgres.Grant(`${schemaName}-restricted-grant-usage`, {
                    database: db.name,
                    schema: schema.name,
                    role: restrictedRole.pgRole.name,
                    privileges: restrictedPerms.includes("w") ? ["SELECT", "INSERT", "UPDATE", "DELETE"] : ["SELECT"],
                    objectType: "table"
                }, {parent: this})

                // TODO: Do we need a sequence grant?
            }

            const usageGrant = new postgres.Grant(`${schemaName}-write-grant-usage`, {
                database: db.name,
                schema: schema.name,
                role: writeRole.pgRole.name,
                privileges: ["usage", "create"],
                objectType: "schema"
            }, {parent: this})

            const tableGrant = new postgres.Grant(`${schemaName}-write-grant-usage`, {
                database: db.name,
                schema: schema.name,
                role: writeRole.pgRole.name,
                privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"],
                objectType: "table"
            }, {parent: this})

            // TODO: Do we need a sequence grant?


        }

    }
}