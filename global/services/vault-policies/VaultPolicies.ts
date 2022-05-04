import * as vault from "@pulumi/vault"
import * as pulumi from "@pulumi/pulumi"
import {readFileSync} from "fs";
import {LayerOne, LayerOneExports} from "../../refs";

const config = new pulumi.Config()

export class VaultPolicies extends pulumi.ComponentResource {
    readonly infraBackend: vault.Mount
    readonly infraPolicy: vault.Policy
    readonly infraToken: vault.Token

    readonly platformBackend: vault.Mount
    readonly platformPolicy: vault.Policy
    readonly platformToken: vault.Token

    readonly githubAuth: vault.github.AuthBackend

    readonly githubReadonlyTeam: vault.github.Team
    readonly githubReadonlyPolicy: vault.Policy

    readonly githubAdminTeam: vault.github.Team
    readonly githubAdminPolicy: vault.Policy


    private readonly vaultProvider: vault.Provider
    private miscBackend: vault.Mount;

    constructor(name: string, args: {}, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:VaultPolicies", name, {}, opts)

        this.vaultProvider = new vault.Provider(`${name}-root-vault-provider`, {
            address: LayerOne.stack.requireOutput(LayerOneExports.VaultAddress),
            token: config.requireSecret("root-vault-token")
        })

        this.infraBackend = new vault.Mount(`${name}-infrastructure-backend`, {
            description: "Contains secrets needed for bootstrapping infrastructure auth elsewhere.",
            path: "infrastructure",
            type: "kv"
        }, {
            provider: this.vaultProvider, parent: this,
        })

        this.infraPolicy = new vault.Policy(`${name}-infrastructure-policy`, {
            name: "infrastructure",
            policy: readFileSync(`${__dirname}/policies/infrastructure.hcl`).toString()
        }, {
            provider: this.vaultProvider, parent: this,
        })

        this.infraToken = new vault.Token(`${name}-infrastructure-token`, {
            displayName: "infrastructure-access",
            policies: [
                this.infraPolicy.name
            ],
            noParent: true,
        }, {
            provider: this.vaultProvider,
            additionalSecretOutputs: ["clientToken"],
            parent: this,
        })

        this.platformBackend = new vault.Mount(`${name}-platform-backend`, {
            description: "Contains secrets that should be exposed to developers",
            path: "platform",
            type: "kv"
        }, {
            provider: this.vaultProvider,
            parent: this,
        })

        this.miscBackend = new vault.Mount(`${name}-misc-backend`, {
            description: "Contains secrets that are manually created by developers",
            path: "misc",
            type: "kv"
        }, {provider: this.vaultProvider, parent: this})

        this.platformPolicy = new vault.Policy(`${name}-platform-policy`, {
            name: "platform",
            policy: readFileSync(`${__dirname}/policies/platform.hcl`).toString()
        }, {
            provider: this.vaultProvider, parent: this
        })

        this.platformToken = new vault.Token(`${name}-platform-token`, {
            displayName: "platform-access",
            policies: [
                this.platformPolicy.name
            ],
            noParent: true,
        }, {
            provider: this.vaultProvider,
            additionalSecretOutputs: ["clientToken"],
            parent: this,
        })

        this.githubAuth = new vault.github.AuthBackend(`${name}-github-auth`, {
            organization: "SprocketBot"
        }, {provider: this.vaultProvider, parent: this,})

        this.githubReadonlyPolicy = new vault.Policy(`${name}-github-readonly-policy`, {
            name: "github-readonly",
            policy: readFileSync(`${__dirname}/policies/github-readonly.hcl`).toString()
        }, {parent: this, provider: this.vaultProvider})
        this.githubReadonlyTeam = new vault.github.Team(`${name}-github-readonly-team`, {
            policies: [
                this.githubReadonlyPolicy.name
            ],
            team: "contributor"
        }, {parent: this, provider: this.vaultProvider})


        this.githubAdminPolicy = new vault.Policy(`${name}-github-admin-policy`, {
            name: "github-admin",
            policy: readFileSync(`${__dirname}/policies/github-admin.hcl`).toString()
        }, {parent: this, provider: this.vaultProvider})
        this.githubAdminTeam = new vault.github.Team(`${name}-github-admin-team`, {
            policies: [
                this.githubAdminPolicy.name
            ],
            team: "maintainers"
        }, {parent: this, provider: this.vaultProvider})

    }
}