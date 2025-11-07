import * as postgres from "@pulumi/postgresql"
import * as postgresql from "@pulumi/postgresql"
import * as pulumi from "@pulumi/pulumi"
import * as vault from "@pulumi/vault"
import { PostgresUser } from "global/helpers/datastore/PostgresUser";
import { PostgresVaultProvider } from "global/services/postgres/PostgresVaultProvider";


const config = new pulumi.Config()

export interface PlatformDatabaseArgs {
    postgresHostname: pulumi.Output<string> | string
    postgresProvider: postgres.Provider
    vaultProvider: vault.Provider
    environmentSubdomain: string
}


interface PlatformGrants {
    dataScience: {
        mledb: {
            usage: postgresql.Grant,
            select: postgresql.Grant
        },
        sprocket: {
            usage: postgresql.Grant,
            select: postgresql.Grant
        },
        history: {
            usage: postgresql.Grant,
            select: postgresql.Grant
        },
        mledbBridge: {
            usage: postgresql.Grant
            select: postgresql.Grant
        }
    }
    elo: {
        dataScience: postgresql.Grant
        platform: postgresql.Grant
    }
}

export class PlatformDatabase extends pulumi.ComponentResource {
    readonly database: { name: string }
    readonly host: string | pulumi.Output<string>
    readonly credentials: PostgresUser
    readonly dataScienceCredentials: PostgresUser

    readonly dataScienceSchema: postgresql.Schema
    readonly mledbSchema: postgresql.Schema
    readonly sprocketSchema: postgresql.Schema
    readonly historySchema: postgresql.Schema
    readonly mledbBridgeSchema: postgresql.Schema

    readonly grants: PlatformGrants = {
        dataScience: {
            mledb: {},
            sprocket: {},
            history: {},
            mledbBridge: {}
        }
    } as PlatformGrants

    // readonly vault: PostgresVaultProvider

    constructor(name: string, args: PlatformDatabaseArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Platform:Database", name, {}, opts)

        this.host = args.postgresHostname

        const developerUsername = `sprocket_${args.environmentSubdomain}`
        this.credentials = new PostgresUser(`${name}-db-user`, {
            providers: { postgres: args.postgresProvider, vault: args.vaultProvider },
            roleArgs: {
                searchPaths: ['sprocket', 'history', 'public']
            },
            keepers: { rotate: "1" },
            username: developerUsername
        })

        const dsUsername = `sprocket_${args.environmentSubdomain}_data_science`;
        this.dataScienceCredentials = new PostgresUser(`${name}-db-ds-user`, {
            providers: { postgres: args.postgresProvider, vault: args.vaultProvider },
            roleArgs: {
                searchPaths: ['sprocket', 'public', 'history', 'data_science']
            },
            keepers: { rotate: "1" },
            username: dsUsername
        })

        // Reference the existing database for this environment
        this.database = { name: `sprocket_${args.environmentSubdomain}` }

        this.mledbSchema = new postgresql.Schema(`${name}-mledb-schema`, {
            database: this.database.name,
            name: "mledb",
            owner: this.credentials.username
        }, { parent: this, provider: args.postgresProvider })

        this.sprocketSchema = new postgresql.Schema(`${name}-sprocket-schema`, {
            database: this.database.name,
            name: "sprocket",
            owner: this.credentials.username
        }, { parent: this, provider: args.postgresProvider })

        this.historySchema = new postgresql.Schema(`${name}-history-schema`, {
            database: this.database.name,
            name: "history",
            owner: this.credentials.username
        }, { parent: this, provider: args.postgresProvider })

        this.dataScienceSchema = new postgresql.Schema(`${name}-data-science-schema`, {
            database: this.database.name,
            name: "data_science",
            owner: this.dataScienceCredentials.username
        }, { parent: this, provider: args.postgresProvider })

        this.mledbBridgeSchema = new postgresql.Schema(`${name}-mledb-bridge-schema`, {
            database: this.database.name,
            name: "mledb_bridge",
            owner: this.credentials.username
        }, { parent: this, provider: args.postgresProvider })

        // Grant select on everything
        this.grants.dataScience.mledb.usage = new postgresql.Grant(`${name}-data-science-mledb-grant-usage`, {
            database: this.database.name,
            objectType: "schema",
            schema: this.mledbSchema.name,
            privileges: ["USAGE"],
            role: this.dataScienceCredentials.username
        }, { parent: this, provider: args.postgresProvider })

        this.grants.dataScience.mledb.select = new postgresql.Grant(`${name}-data-science-mledb-grant-tables`, {
            database: this.database.name,
            objectType: "table",
            schema: this.mledbSchema.name,
            privileges: ["SELECT"],
            role: this.dataScienceCredentials.username
        }, { parent: this, provider: args.postgresProvider })

        this.grants.dataScience.sprocket.usage = new postgresql.Grant(`${name}-data-science-sprocket-grant-usage`, {
            database: this.database.name,
            objectType: "schema",
            schema: this.sprocketSchema.name,
            privileges: ["USAGE"],
            role: this.dataScienceCredentials.username
        }, { parent: this, provider: args.postgresProvider })


        this.grants.dataScience.sprocket.select = new postgresql.Grant(`${name}-data-science-sprocket-grant`, {
            database: this.database.name,
            objectType: "table",
            schema: this.sprocketSchema.name,
            privileges: ["SELECT"],
            role: this.dataScienceCredentials.username
        }, { parent: this, provider: args.postgresProvider })


        this.grants.dataScience.history.usage = new postgresql.Grant(`${name}-data-science-history-grant-usage`, {
            database: this.database.name,
            objectType: "schema",
            schema: this.historySchema.name,
            privileges: ["USAGE"],
            role: this.dataScienceCredentials.username
        }, { parent: this, provider: args.postgresProvider })


        this.grants.dataScience.history.select = new postgresql.Grant(`${name}-data-science-history-grant`, {
            database: this.database.name,
            objectType: "table",
            schema: this.historySchema.name,
            privileges: ["SELECT"],
            role: this.dataScienceCredentials.username
        }, { parent: this, provider: args.postgresProvider })

        this.grants.dataScience.mledbBridge.usage = new postgresql.Grant(`${name}-data-science-mledb-bridge-grant-usage`, {
            database: this.database.name,
            objectType: "schema",
            schema: this.mledbBridgeSchema.name,
            privileges: ["USAGE"],
            role: this.dataScienceCredentials.username
        }, { parent: this, provider: args.postgresProvider })

        this.grants.dataScience.mledbBridge.select = new postgresql.Grant(`${name}-data-science-mledb-bridge-grant`, {
            database: this.database.name,
            objectType: "table",
            schema: this.mledbBridgeSchema.name,
            privileges: ["SELECT"],
            role: this.dataScienceCredentials.username
        }, { parent: this, provider: args.postgresProvider })

        // this.vault = new PostgresVaultProvider(`${name}-vault`, {
        //     environment: args.environmentSubdomain,
        //     pg: {
        //         credentials: this.credentials,
        //         hostname: pulumi.output(args.postgresHostname),
        //         dbName: this.database.name,
        //         provider: args.postgresProvider
        //     },
        //     dataScienceRole: dsUsername,
        //     developerRole: developerUsername,
        //     vaultProvider: args.vaultProvider
        // }, { parent: this })



    }
}
