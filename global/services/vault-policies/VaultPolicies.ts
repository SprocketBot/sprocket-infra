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

    private readonly vaultProvider: vault.Provider

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
            provider: this.vaultProvider, parent: this
        })

        this.infraPolicy = new vault.Policy(`${name}-infrastructure-policy`, {
            name: "infrastructure",
            policy: readFileSync(`${__dirname}/policies/infrastructure.hcl`).toString()
        }, {
            provider: this.vaultProvider, parent: this
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
            parent: this
        })

        this.platformBackend = new vault.Mount(`${name}-platform-backend`, {
            description: "Contains secrets that should be exposed to developers",
            path: "platform",
            type: "kv"
        }, {
            provider: this.vaultProvider,
            parent: this
        })

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
            parent: this
        })


    }
}