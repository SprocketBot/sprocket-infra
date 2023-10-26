import * as pulumi from "@pulumi/pulumi";
import * as vault from "@pulumi/vault";
import * as docker from "@pulumi/docker";
import { Outputable } from "../types";
import { VaultConstants } from "../constants";
import { getVaultProvider } from "../providers";

type KeyedRecord<K extends string, V> = {
  [P in K]: V;
};

export const vaultPathToDockerSecrets = async <T extends string>(
  path: string,
  mount: VaultConstants.Backend,
  keys: T[],
  parent?: pulumi.Resource,
): Promise<KeyedRecord<T, docker.Secret>> => {
  const result = await vault.kv.getSecretV2(
    {
      name: path,
      mount: mount,
    },
    { provider: getVaultProvider() },
  );

  const output: KeyedRecord<T, docker.Secret> = {} as KeyedRecord<
    T,
    docker.Secret
  >;
  for (const key of keys) {
    if (!(key in result.data))
      throw new Error(
        `Could not translate vault: \`${mount}/${path}#${key}\` is missing`,
      );
    // TODO: Cache secrets to share when possible?
    output[key] = new docker.Secret(
      `${path.split("/").slice(2).join("__")}__${key}`,
      {
        data: btoa(result.data[key] || "___empty-value___"),
      },
      { parent: parent },
    );
  }

  return output;
};
// maintainer__manual__discord-oauth__client_secret-fed8b47
// maintainer__manual__discord-oauth__client_secret-fed8b47
