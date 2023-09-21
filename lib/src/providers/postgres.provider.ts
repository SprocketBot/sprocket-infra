import * as postgres from "@pulumi/postgresql";
import * as vault from "@pulumi/vault";

import {
  InfrastructureStackOutputs,
  InfrastructureStackRef,
} from "../stack-refs";
import { VaultConstants } from "../constants";
import { getVaultProvider } from "./vault.provider";

let provider: postgres.Provider;

export const getPostgresProvider = () => {
  if (provider) return provider;
  if (InfrastructureStackRef === null)
    throw new Error("InfrastructureStackRef is null!");
  const vaultConnName = InfrastructureStackRef.getOutput(
    InfrastructureStackOutputs.PostgresVaultConnectionName,
  );

  const vaultRootRolePath = InfrastructureStackRef.getOutput(
    InfrastructureStackOutputs.PostgresVaultRootRolePath,
  );

  const pgHostname = InfrastructureStackRef.getOutput(
    InfrastructureStackOutputs.PostgresExternalHostname,
  );

  const freshCredentials = vault.kv.getSecretV2Output(
    {
      mount: VaultConstants.Backend.kv2,
      name: vaultRootRolePath,
    },
    { provider: getVaultProvider() },
  );

  provider = new postgres.Provider(
    "pg-provider",
    {
      host: pgHostname,
      sslmode: "require",
      port: 443,
      username: freshCredentials.data.apply(($d) => $d.username),
      password: freshCredentials.data.apply(($d) => $d.password),
    },
    {},
  );

  return provider;
};
