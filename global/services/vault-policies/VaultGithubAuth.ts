import * as vault from "@pulumi/vault"
import * as pulumi from "@pulumi/pulumi"
import {readFileSync} from "fs";

export interface VaultGithubAuthArgs {
    vaultProvider: vault.Provider
}

export class VaultGithubAuth extends pulumi.ComponentResource {
    readonly githubAuth: vault.github.AuthBackend

    readonly githubReadonlyTeam: vault.github.Team
    readonly githubReadonlyPolicy: vault.Policy

    readonly githubAdminTeam: vault.github.Team
    readonly githubAdminPolicy: vault.Policy

    readonly githubDataScienceTeam: vault.github.Team
    readonly githubDataSciencePolicy: vault.Policy

    readonly vaultProvider: vault.Provider

    constructor(name: string, args: VaultGithubAuthArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:VaultPolicies:GithubAuth", name, {}, opts)

        this.vaultProvider = args.vaultProvider

        this.githubAuth = new vault.github.AuthBackend(`${name}-github-auth`, {
            organization: "SprocketBot"
        }, {provider: this.vaultProvider, parent: this })

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

        this.githubDataSciencePolicy = new vault.Policy(`${name}-github-ds-policy`, {
            name: "github-data-science",
            policy: readFileSync(`${__dirname}/policies/github-data-science.hcl`).toString()
        }, {parent: this, provider: this.vaultProvider})

        this.githubDataScienceTeam = new vault.github.Team(`${name}-github-datascience-team`, {
            policies: [
                this.githubDataSciencePolicy.name
            ],
            team: "data-science"
        }, {parent: this, provider: this.vaultProvider})
    }
}
