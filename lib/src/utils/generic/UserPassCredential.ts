import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";
import * as vault from "@pulumi/vault";
import { VaultConstants, buildUrn, URN_TYPE } from "../../constants";
import { Outputable } from "../../types";
import { VaultUtils } from "..";

export type UserPassCredentialArgs = {
  path: {
    name: Outputable<string>;
    mount?: Outputable<string>;
  };
  username?: Outputable<string>;
  passwordArgs?: Partial<random.RandomPasswordArgs>;
  vaultData?: Outputable<Record<string, string | number | boolean>>;
  /**
   * If frozen, the vault value will ignore all changes, and vaultData will be ignored
   * This is used in contexts like database and service initialization where they cannot
   * be reset automatically (ergonomically)
   */
  freeze?: boolean;
};

export class UserPassCredential extends pulumi.ComponentResource {
  private readonly passwordResource: random.RandomPassword;
  private readonly usernameResource?: random.RandomPet;
  private readonly secret: vault.generic.Secret;

  readonly password: Outputable<string>;
  readonly username: Outputable<string>;
  readonly path: Outputable<string>;
  readonly pathName: Outputable<string>;

  constructor(
    name: string,
    args: UserPassCredentialArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.Utility, "UserPassCredential"), name, {}, opts);

    this.passwordResource = new random.RandomPassword(
      "password",
      {
        length: 64,
        upper: true,
        lower: true,
        number: true,
        special: true,
        ...args.passwordArgs,
      },
      { parent: this },
    );

    if (!args.username)
      this.usernameResource = new random.RandomPet(
        "username",
        {},
        { parent: this },
      );

    const mount = pulumi
      .output(
        args.path.mount ??
          VaultUtils.getBackend(VaultConstants.Backend.kv2)?.path,
      )
      .apply(($mount) => {
        if (!$mount)
          throw new Error(
            "Unable to determine which secrets store to use; please specify one manually",
          );
        return $mount;
      });

    this.secret = new vault.kv.SecretV2(
      `${name}-vs`,
      {
        name: args.path.name,
        mount: mount,
        dataJson: pulumi
          .all([
            this.passwordResource.result,
            this.usernameResource?.id ?? args.username!.toString(),
            args.vaultData ?? {},
          ])
          .apply(([$password, $username, $data = {}]) =>
            JSON.stringify({
              // Do not pass $data if this is a frozen credential
              ...(args.freeze ? {} : $data),
              username: $username,
              password: $password,
            }),
          ),
      },
      {
        parent: this,
        ignoreChanges: args.freeze ? ["username", "password"] : undefined,
      },
    );

    this.password = this.passwordResource.result;
    this.username = this.usernameResource?.id ?? args.username!;
    this.path = this.secret.path;
    this.pathName = args.path.name;
  }
}
