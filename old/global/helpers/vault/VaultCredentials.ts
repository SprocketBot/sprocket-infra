import * as pulumi from "@pulumi/pulumi";
import * as vault from "@pulumi/vault";
import * as random from "@pulumi/random";

const defaultPasswordOptions: random.RandomPasswordArgs = {
  length: 64,
  upper: true,
  lower: true,
  special: false,
  number: true,
};

export interface VaultPasswordArgs {
  passwordOptions?: Partial<random.RandomPasswordArgs>;
  username: string;
  vault: {
    path: string;
    provider: vault.Provider;
  };
  additionalVaultData?: Record<string, string>;
}

export class VaultCredentials extends pulumi.ComponentResource {
  private readonly vaultSecret: vault.generic.Secret;

  readonly username: pulumi.Output<string>;
  readonly password: pulumi.Output<string>;
  readonly passwordResource: random.RandomPassword;

  constructor(
    name: string,
    args: VaultPasswordArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    if (!args.vault.path) throw new Error("vault.path must be defined!");

    super("SprocketBot:Components:VaultBackedPassword", name, {}, opts);

    this.passwordResource = new random.RandomPassword(
      `${name}-password`,
      { ...defaultPasswordOptions, ...args.passwordOptions },
      { parent: this },
    );
    this.vaultSecret = new vault.generic.Secret(
      `${name}-vs`,
      {
        path: args.vault.path,
        dataJson: this.passwordResource.result.apply((pw) =>
          JSON.stringify({
            ...(args.additionalVaultData ?? {}),
            username: args.username,
            password: pw,
          }),
        ),
      },
      { parent: this, provider: args.vault.provider },
    );

    this.username = this.vaultSecret.data.username as pulumi.Output<string>;
    this.password = this.passwordResource.result as pulumi.Output<string>;
  }
}
