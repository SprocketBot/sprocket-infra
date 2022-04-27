import * as vault from "@pulumi/vault"
import * as pulumi from "@pulumi/pulumi"
import {readFileSync} from "fs";
import {LayerOne, LayerOneExports} from "../../refs";
import {stackLocations} from "../../StackLocations";

const config = new pulumi.Config()

export class VaultPolicies extends pulumi.ComponentResource {
    readonly infraBackend: vault.Mount
    readonly infraPolicy: vault.Policy
    readonly infraToken: vault.Token
    private readonly vaultProvider: vault.Provider

    constructor(name: string, args: {}, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:VaultPolicies", name, {}, opts)

        this.vaultProvider = new vault.Provider(`${name}-root-vault-provider`, {
            address: LayerOne.stack.requireOutput(LayerOneExports.VaultAddress),
            token: config.requireSecret("root-vault-token")
        })


        this.infraBackend = new vault.Mount("infrastructure-backend", {
            description: "Contains secrets needed for bootstrapping infrastructure auth elsewhere.",
            path: "infrastructure",
            type: "kv"
        }, {
            provider: this.vaultProvider, parent: this
        })

        this.infraPolicy = new vault.Policy("infrastructure-policy", {
            name: "infrastructure",
            policy: readFileSync(`${__dirname}/policies/infrastructure.hcl`).toString()
        }, {
            provider: this.vaultProvider, parent: this
        })

        this.infraToken = new vault.Token("infrastructure-token", {
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
    }
}