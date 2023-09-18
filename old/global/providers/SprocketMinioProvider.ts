import * as vault from "@pulumi/vault";
import { VaultCredentials } from "../helpers/vault/VaultCredentials";
import * as minio from "@pulumi/minio";
import * as pulumi from "@pulumi/pulumi";
import { HOSTNAME } from "../constants";

export interface SprocketMinioProviderArgs
  extends Omit<
    minio.ProviderArgs,
    "minioAccessKey" | "minioSecretKey" | "minioServer" | "minioInsecure"
  > {
  vaultProvider: vault.Provider;
  minioCredentials?: VaultCredentials;
  minioHostname: pulumi.Output<string> | string;
}

export class SprocketMinioProvider extends minio.Provider {
  constructor(
    {
      vaultProvider,
      minioCredentials,
      minioHostname,
      ...args
    }: SprocketMinioProviderArgs,
    opts?: pulumi.ResourceOptions,
  ) {
    let username, password;
    if (minioCredentials) {
      username = minioCredentials.username;
      password = minioCredentials.password;
    } else {
      const secret = vault.generic.getSecretOutput(
        {
          path: "infrastructure/minio/root",
        },
        {
          provider: vaultProvider,
        },
      );
      username = secret.data.apply((d) => d.username);
      password = secret.data.apply((d) => d.password);
    }

    super(
      "SprocketMinioProvider",
      {
        ...args,
        minioAccessKey: username,
        minioSecretKey: password,
        minioServer: minioHostname,
        minioSsl: true,
      },
      opts,
    );
  }
}
