import * as vault from "@pulumi/vault"
import * as pulumi from "@pulumi/pulumi"
import {readFileSync} from "fs";
import {VaultGithubTeam} from "./VaultGithubTeam";

export interface VaultGithubAuthArgs {
    vaultProvider: vault.Provider
}

export class VaultGithubAuth extends pulumi.ComponentResource {
    readonly githubAuth: vault.github.AuthBackend

    readonly readonlyTeam: VaultGithubTeam
    readonly adminTeam: VaultGithubTeam
    readonly dataScienceTeam: VaultGithubTeam
    readonly eloTeam: VaultGithubTeam
		readonly dbTeam: VaultGithubTeam

    readonly vaultProvider: vault.Provider

    constructor(name: string, args: VaultGithubAuthArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:VaultPolicies:GithubAuth", name, {}, opts)

        this.vaultProvider = args.vaultProvider

        this.githubAuth = new vault.github.AuthBackend(`${name}-github-auth`, {
            organization: "SprocketBot"
        }, {provider: this.vaultProvider, parent: this })

        this.readonlyTeam = new VaultGithubTeam(`${name}-readonly-team`, {
            team: "contributor",
            name: "readonly-team",
            policyContent: readFileSync(`${__dirname}/policies/github-readonly.hcl`).toString(),
            vaultProvider: this.vaultProvider
        }, { parent: this })

        this.adminTeam = new VaultGithubTeam(`${name}-admin-team`, {
            team: "maintainers",
            name: "admin-team",
            policyContent: readFileSync(`${__dirname}/policies/github-admin.hcl`).toString(),
            vaultProvider: this.vaultProvider
        }, { parent: this })

        this.dataScienceTeam = new VaultGithubTeam(`${name}-ds-team`, {
            team: "data-science",
            name: "data-science-team",
            policyContent: readFileSync(`${__dirname}/policies/github-data-science.hcl`).toString(),
            vaultProvider: this.vaultProvider
        }, { parent: this })

        this.eloTeam = new VaultGithubTeam(`${name}-elo-team`, {
            team: "elo",
            name: "elo-team",
            policyContent: readFileSync(`${__dirname}/policies/github-elo.hcl`).toString(),
            vaultProvider: this.vaultProvider
        }, { parent: this })

        this.dbTeam = new VaultGithubTeam(`${name}-database-team`, {
            team: "database",
            name: "database-team",
            policyContent: readFileSync(`${__dirname}/policies/github-db.hcl`).toString(),
            vaultProvider: this.vaultProvider
        }, { parent: this })

    }
}
