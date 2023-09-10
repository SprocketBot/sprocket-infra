import * as pulumi from "@pulumi/pulumi";
import * as postgresql from "@pulumi/postgresql";
import * as vault from "@pulumi/vault";
import * as random from "@pulumi/random"
import {PostgresUser} from "../../helpers/datastore/PostgresUser";

export interface PostgresVaultProviderArgs {
    pg: {
        provider: postgresql.Provider
        credentials: PostgresUser,
        hostname: pulumi.Output<string>,
        dbName: pulumi.Output<string>
    }
    vaultProvider: vault.Provider,
    developerRole: string,
    dataScienceRole: string,
    environment: string
}

export class PostgresVaultProvider extends pulumi.ComponentResource {
    private readonly connRole: postgresql.Role
    readonly connection: vault.database.SecretBackendConnection
    readonly devRole: vault.database.SecretBackendRole
    readonly dataScienceRole: vault.database.SecretBackendRole

    constructor(name: string, args: PostgresVaultProviderArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Services:Postgres:VaultProvider", name, {}, opts);

        this.connRole = new postgresql.Role(`${name}-base-role`, {
            name: `${args.environment}-dynamic-role-creator`,
            superuser: true,
            login: true,
            password: new random.RandomPassword(`${name}-base-role-password`, {length: 64}, {parent: this}).result
        }, { parent: this, provider: args.pg.provider })

        this.connection = new vault.database.SecretBackendConnection(`${name}-backend-conn`, {
            name: `SprocketPostgres-${args.environment}`,
            allowedRoles: [
                `developer_${args.environment}`,
                `data_science_${args.environment}`,
            ],
            backend: "database",
            postgresql: {
                username: this.connRole.name,
                password: this.connRole.password as pulumi.Output<string>,
                connectionUrl: pulumi.all([args.pg.hostname, args.pg.dbName]).apply(([h,db]) => `postgresql://{{username}}:{{password}}@${h}:5432/${db}?sslmode=disable`),
                usernameTemplate: "{{.RoleName}}-{{.DisplayName}}-{{unix_time}}",
            }
        }, { parent: this, provider: args.vaultProvider})

        const makeRole = (roleName: string, suffix: string) => new vault.database.SecretBackendRole(`${name}-${roleName}`, {
            name: `${suffix}_${args.environment}`,
            backend: "database",
            dbName: this.connection.name,

            creationStatements: [
                `CREATE ROLE "{{name}}" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';`,
                `GRANT ${roleName} TO "{{name}}";`
            ],
            revocationStatements: [
                `DROP ROLE "{{name}}";`
            ],
            renewStatements: [
                `ALTER USER "{{name}}" VALID UNTIL '{{expiration}}';`
            ]
        }, { parent: this, provider: args.vaultProvider });

        this.devRole = makeRole(args.developerRole, "developer");
        this.dataScienceRole = makeRole(args.dataScienceRole, "data_science");
    }
}
