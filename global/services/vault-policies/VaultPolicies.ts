import * as vault from "@pulumi/vault"
import * as pulumi from "@pulumi/pulumi"
import { readFileSync } from "fs";
import { LayerOne, LayerOneExports } from "../../refs";
import { VaultGithubAuth } from "./VaultGithubAuth";
import { VaultBackend } from "./VaultBackend";
import * as random from "@pulumi/random";

const config = new pulumi.Config()

export class VaultPolicies extends pulumi.ComponentResource {
    readonly infraBackend: VaultBackend
    readonly infraToken: vault.Token

    readonly platformBackend: VaultBackend
    readonly platformToken: vault.Token

    readonly githubAuth: VaultGithubAuth

    private readonly vaultProvider: vault.Provider
    private miscBackend: vault.Mount;
    private databaseBackend: vault.Mount;

    constructor(name: string, args: {}, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:VaultPolicies", name, {}, opts)

        this.vaultProvider = new vault.Provider(`${name}-root-vault-provider`, {
            address: LayerOne.stack.requireOutput(LayerOneExports.VaultAddress),
            token: readFileSync('/root/sprocket-infra/global/services/vault/unseal-tokens/root_token.txt', 'utf8').trim()
        })

        this.infraBackend = new VaultBackend(`${name}-infra`, {
            vaultProvider: this.vaultProvider,
            description: "Contains secrets needed for bootstrapping infrastructure auth elsewhere.",
            path: "infrastructure",
            policyContent: readFileSync(`${__dirname}/policies/infrastructure.hcl`).toString()
        }, { provider: this.vaultProvider })

        this.infraToken = this.infraBackend.token

        this.platformBackend = new VaultBackend(`${name}-platform`, {
            vaultProvider: this.vaultProvider,
            description: "Contains secrets that should be exposed to developers" +
                "dev/* access is readonly by default" +
                "dev/manual/* access is mutable by developers.",
            path: "platform",
            policyContent: readFileSync(`${__dirname}/policies/platform.hcl`).toString()
        }, { provider: this.vaultProvider })

        this.platformToken = this.platformBackend.token

        // Read credentials from Pulumi config
        const postgresHost = config.require('postgres-host');
        const postgresPort = config.requireNumber('postgres-port');
        const postgresUsername = config.require('postgres-username');
        const postgresPassword = config.requireSecret('postgres-password');

        const postgresSecretData = pulumi.output({
            host: postgresHost,
            port: postgresPort,
            username: postgresUsername,
            password: postgresPassword
        }).apply(data => JSON.stringify(data));

        new vault.generic.Secret("postgres-root-secret", {
            path: "infrastructure/data/postgres/root",
            dataJson: postgresSecretData
        }, { provider: this.vaultProvider, dependsOn: [this.infraBackend.backend] });

        console.log("Created postgres root secret at infrastructure/data/postgres/root");

        const minioHost = config.get('minioHost');
        const minioPort = config.getNumber('minioPort');
        const minioUsername = config.get('minioUsername');
        const minioPassword = config.getSecret('minioPassword');

        const minioSecretData = pulumi.output({
            host: minioHost,
            port: minioPort,
            username: minioUsername,
            password: minioPassword
        }).apply(data => JSON.stringify(data));

        new vault.generic.Secret("minio-root-secret", {
            path: "infrastructure/data/minio/root",
            dataJson: minioSecretData
        }, { provider: this.vaultProvider, dependsOn: [this.infraBackend.backend] });

        const smtpHost = config.get('smtpHost');
        const smtpPort = config.getNumber('smtpPort');
        const smtpUsername = config.get('smtpUsername');
        const smtpPassword = config.getSecret('smtpPassword');

        const smtpSecretData = pulumi.output({
            host: smtpHost,
            port: smtpPort,
            username: smtpUsername,
            password: smtpPassword
        }).apply(data => JSON.stringify(data));

        new vault.generic.Secret("smtp-secret", {
            path: "infrastructure/data/smtp",
            dataJson: smtpSecretData
        }, { provider: this.vaultProvider, dependsOn: [this.infraBackend.backend] });

        const redisHost = config.get('redisHost');
        const redisPort = config.getNumber('redisPort');
        const redisPassword = config.getSecret('redisPassword');

        const redisSecretData = pulumi.output({
            host: redisHost,
            port: redisPort,
            password: redisPassword
        }).apply(data => JSON.stringify(data));

        new vault.generic.Secret("redis-root-secret", {
            path: "infrastructure/data/redis",
            dataJson: redisSecretData
        }, { provider: this.vaultProvider, dependsOn: [this.infraBackend.backend] });

        this.miscBackend = new vault.Mount(`${name}-misc-backend`, {
            description: "Contains secrets that are manually created by developers. Should not be used by applications directly.",
            path: "misc",
            type: "kv"
        }, { provider: this.vaultProvider, parent: this })

        this.databaseBackend = new vault.Mount(`${name}-mount`, {
            type: "database", path: "database"
        }, { parent: this, provider: this.vaultProvider })

        this.githubAuth = new VaultGithubAuth(`${name}-gh`, {
            vaultProvider: this.vaultProvider
        })

    }
}
