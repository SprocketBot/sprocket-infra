import * as postgres from "@pulumi/postgresql"
import * as postgresql from "@pulumi/postgresql"
import * as pulumi from "@pulumi/pulumi"
import * as vault from "@pulumi/vault"
import {PostgresUser} from "global/helpers/datastore/PostgresUser";


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
    }
    elo: {
        dataScience: postgresql.Grant
        platform: postgresql.Grant
    }
}

export class PlatformDatabase extends pulumi.ComponentResource {
    readonly database: postgresql.Database
    readonly host: string | pulumi.Output<string>
    readonly credentials: PostgresUser
    readonly dataScienceCredentials: PostgresUser

    readonly dataScienceSchema: postgresql.Schema
    readonly mledbSchema: postgresql.Schema
    readonly sprocketSchema: postgresql.Schema

    readonly grants: PlatformGrants = {
        dataScience: {
            mledb: {
            },
            sprocket: {
            }
        },
        elo: {
        }
    } as PlatformGrants

    constructor(name: string, args: PlatformDatabaseArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Platform:Database", name, {}, opts)

        this.host = args.postgresHostname

        this.credentials = new PostgresUser(`${name}-db-user`, {
            providers: {postgres: args.postgresProvider, vault: args.vaultProvider},
            username: `sprocket_${args.environmentSubdomain}`
        })

        this.dataScienceCredentials = new PostgresUser(`${name}-db-ds-user`, {
            providers: {postgres: args.postgresProvider, vault: args.vaultProvider},
            username: `sprocket_${args.environmentSubdomain}_data_science`
        })

        this.database = new postgresql.Database(`${name}-database`, {
            name: `sprocket_${args.environmentSubdomain}`,
            owner: this.credentials.username
        }, {parent: this, provider: args.postgresProvider})

        this.mledbSchema = new postgresql.Schema(`${name}-mledb-schema`, {
            database: this.database.name,
            name: "mledb",
            owner: this.credentials.username
        }, {parent: this, provider: args.postgresProvider})

        this.sprocketSchema = new postgresql.Schema(`${name}-sprocket-schema`, {
            database: this.database.name,
            name: "sprocket",
            owner: this.credentials.username
        }, {parent: this, provider: args.postgresProvider})

        this.dataScienceSchema = new postgresql.Schema(`${name}-data-science-schema`, {
            database: this.database.name,
            name: "data_science",
            owner: this.dataScienceCredentials.username
        }, {parent: this, provider: args.postgresProvider})

        // Grant select on everything
        this.grants.dataScience.mledb.usage = new postgresql.Grant(`${name}-data-science-mledb-grant-usage`, {
            database: this.database.name,
            objectType: "schema",
            schema: this.mledbSchema.name,
            privileges: ["USAGE"],
            role: this.dataScienceCredentials.username
        }, {parent: this, provider: args.postgresProvider})

        this.grants.dataScience.mledb.select = new postgresql.Grant(`${name}-data-science-mledb-grant-tables`, {
            database: this.database.name,
            objectType: "table",
            schema: this.mledbSchema.name,
            privileges: ["SELECT"],
            role: this.dataScienceCredentials.username
        }, {parent: this, provider: args.postgresProvider})

        this.grants.dataScience.sprocket.usage = new postgresql.Grant(`${name}-data-science-sprocket-grant-usage`, {
            database: this.database.name,
            objectType: "schema",
            schema: this.sprocketSchema.name,
            privileges: ["USAGE"],
            role: this.dataScienceCredentials.username
        }, {parent: this, provider: args.postgresProvider})


        this.grants.dataScience.sprocket.select = new postgresql.Grant(`${name}-data-science-sprocket-grant`, {
            database: this.database.name,
            objectType: "table",
            schema: this.sprocketSchema.name,
            privileges: ["SELECT"],
            role: this.dataScienceCredentials.username
        }, {parent: this, provider: args.postgresProvider})


        // Revoke everything on elo data
        this.grants.elo.dataScience = new postgresql.Grant(`${name}-data-science-elo-revoke`, {
            database: this.database.name,
            objectType: "table",
            objects: ["elo_data"],
            schema: this.mledbSchema.name,
            privileges: [],
            role: this.dataScienceCredentials.username
        }, {parent: this, provider: args.postgresProvider})

        this.grants.elo.platform = new postgresql.Grant(`${name}-elo-revoke`, {
            database: this.database.name,
            objectType: "table",
            objects: ["elo_data"],
            schema: this.mledbSchema.name,
            privileges: [],
            role: this.credentials.username
        }, {parent: this, provider: args.postgresProvider})



    }
}
