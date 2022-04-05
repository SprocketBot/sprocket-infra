import * as vault from "@pulumi/vault"
import * as pulumi from "@pulumi/pulumi"
import {stackLocations} from "global/refs";
import {RootVaultProvider} from "./RootVaultProvider";
import {readFileSync} from "fs";

const infraBackend = new vault.Mount("infrastructure-backend", {
    description: "Contains secrets needed for bootstrapping infrastructure auth elsewhere.",
    path: "infrastructure",
    type: "kv"
}, {
    provider: RootVaultProvider
})

const infraPolicy = new vault.Policy("infrastructure-policy", {
    name: "infrastructure",
    policy: readFileSync(`${__dirname}/policies/infrastructure.hcl`).toString()
}, {
    provider: RootVaultProvider
})

const infraToken = new vault.Token("infrastructure-token", {
    displayName: "infrastructure-access",
    policies: [
        infraPolicy.name
    ],
    noParent: true,
}, {
    provider: RootVaultProvider,
    additionalSecretOutputs: ["clientToken"]
})
async function updateToken() {
    for(const l of stackLocations) {
        const workspace = await pulumi.automation.LocalWorkspace.create({workDir: l.workDir})
        const stack = await pulumi.automation.Stack.select(l.name, workspace)
        infraToken.clientToken.apply(token => stack.setConfig(`${l.name}:vault-token`, {
            value: token,
            secret: true
        }))
    }
}
updateToken()