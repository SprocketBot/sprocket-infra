import * as vault from "@pulumi/vault";
import * as pulumi from "@pulumi/pulumi";
import { readFileSync } from "fs";

export interface VaultGithubTeamArgs {
  team: string;
  policyContent: string;
  name: string;
  vaultProvider: vault.Provider;
}

export class VaultGithubTeam extends pulumi.ComponentResource {
  readonly team: vault.github.Team;
  readonly policy: vault.Policy;

  constructor(
    name: string,
    args: VaultGithubTeamArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("SprocketBot:VaultPolicies:GithubAuthTeam", name, {}, opts);
    this.policy = new vault.Policy(
      `${name}-policy`,
      {
        name: args.name,
        policy: args.policyContent,
      },
      { parent: this, provider: args.vaultProvider },
    );

    this.team = new vault.github.Team(
      `${name}-team`,
      {
        policies: [this.policy.name],
        team: args.team,
      },
      { parent: this, provider: args.vaultProvider },
    );
  }
}
