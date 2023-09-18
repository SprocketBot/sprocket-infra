import * as vault from "@pulumi/vault";
import * as pulumi from "@pulumi/pulumi";
import { readFileSync } from "fs";
import { LayerOne, LayerOneExports } from "../../refs";
import { VaultGithubAuth } from "./VaultGithubAuth";
import { VaultBackend } from "./VaultBackend";

const config = new pulumi.Config();

export class VaultPolicies extends pulumi.ComponentResource {
  readonly infraBackend: VaultBackend;
  readonly infraToken: vault.Token;

  readonly platformBackend: VaultBackend;
  readonly platformToken: vault.Token;

  readonly githubAuth: VaultGithubAuth;

  private readonly vaultProvider: vault.Provider;
  private miscBackend: vault.Mount;
  private databaseBackend: vault.Mount;

  constructor(name: string, args: {}, opts?: pulumi.ComponentResourceOptions) {
    super("SprocketBot:VaultPolicies", name, {}, opts);

    this.vaultProvider = new vault.Provider(`${name}-root-vault-provider`, {
      address: LayerOne.stack.requireOutput(LayerOneExports.VaultAddress),
      token: config.requireSecret("root-vault-token"),
    });

    this.infraBackend = new VaultBackend(
      `${name}-infra`,
      {
        vaultProvider: this.vaultProvider,
        description:
          "Contains secrets needed for bootstrapping infrastructure auth elsewhere.",
        path: "infrastructure",
        policyContent: readFileSync(
          `${__dirname}/policies/infrastructure.hcl`,
        ).toString(),
      },
      { provider: this.vaultProvider },
    );

    this.infraToken = this.infraBackend.token;

    this.platformBackend = new VaultBackend(
      `${name}-platform`,
      {
        vaultProvider: this.vaultProvider,
        description:
          "Contains secrets that should be exposed to developers" +
          "dev/* access is readonly by default" +
          "dev/manual/* access is mutable by developers.",
        path: "platform",
        policyContent: readFileSync(
          `${__dirname}/policies/platform.hcl`,
        ).toString(),
      },
      { provider: this.vaultProvider },
    );

    this.platformToken = this.platformBackend.token;

    this.miscBackend = new vault.Mount(
      `${name}-misc-backend`,
      {
        description:
          "Contains secrets that are manually created by developers. Should not be used by applications directly.",
        path: "misc",
        type: "kv",
      },
      { provider: this.vaultProvider, parent: this },
    );

    this.databaseBackend = new vault.Mount(
      `${name}-mount`,
      {
        type: "database",
        path: "database",
      },
      { parent: this, provider: this.vaultProvider },
    );

    this.githubAuth = new VaultGithubAuth(`${name}-gh`, {
      vaultProvider: this.vaultProvider,
    });
  }
}
