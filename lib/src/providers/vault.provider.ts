import * as pulumi from "@pulumi/pulumi";
import * as vault from "@pulumi/vault";
import {
  InfrastructureStackOutputs,
  InfrastructureStackRef,
} from "../stack-refs";

let provider: vault.Provider;

export const setVaultProvider = (p: vault.Provider) => {
  if (provider)
    throw new Error(
      "Vault provider has already been set, aborting to prevent multiple from being created",
    );
  provider = p;
  return provider;
};

export const getVaultProvider = () => {
  if (provider) return provider;
  if (pulumi.getStack() === "infra")
    throw new Error(
      "Vault provider is unavailable in the infrastructure stack",
    );
  if (InfrastructureStackRef === null)
    throw new Error(
      "Vault provider is unavailable in the infrastructure stack",
    );
  const endpoint = InfrastructureStackRef.getOutput(
    InfrastructureStackOutputs.VaultHostname,
  );
  const secretId = InfrastructureStackRef.getOutput(
    InfrastructureStackOutputs.VaultApproleSecretId,
  );
  const roleId = InfrastructureStackRef.getOutput(
    InfrastructureStackOutputs.VaultApproleRoleId,
  );

  provider = new vault.Provider("provider", {
    address: endpoint,
    token: "",
    authLogin: {
      path: "/auth/approle/login",
      parameters: {
        secret_id: secretId,
        role_id: roleId,
      },
    },
  });
  return provider;
};
