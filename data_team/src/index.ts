import {
  getPostgresProvider,
  getVaultProvider,
  InfrastructureStackOutputs,
  InfrastructureStackRef,
  Mage,
  Prefect,
  VaultConstants,
} from "@sprocketbot/infra-lib";
import * as vault from "@pulumi/vault";

if (InfrastructureStackRef === null) throw new Error();

const githubAccessToken = vault.kv
  .getSecretV2Output(
    {
      name: "maintainer/manual/github-pat",
      mount: VaultConstants.Backend.kv2,
    },
    { provider: getVaultProvider() }
  )
  .apply(($data) => $data.data.accessToken as string);

new Prefect(
  "test-prefect",
  {
    ingress: {
      networkId: InfrastructureStackRef.getOutput(
        InfrastructureStackOutputs.IngressNetworkId
      ),
    },
    pg: {
      hostname: InfrastructureStackRef.getOutput(
        InfrastructureStackOutputs.PostgresInternalHostname
      ),
      networkId: InfrastructureStackRef.getOutput(
        InfrastructureStackOutputs.PostgresNetworkId
      ),
      port: 5432,
      vaultConnName: InfrastructureStackRef.getOutput(
        InfrastructureStackOutputs.PostgresVaultConnectionName
      ),
    },
    envs: {
      GITHUB_PAT: githubAccessToken,
    },
  },
  {
    providers: [getVaultProvider(), getPostgresProvider()],
  }
);

//new Mage("ds-mage", {
//  ingressNetworkId: InfrastructureStackRef.getOutput(
//    InfrastructureStackOutputs.IngressNetworkId
//  ),
//  githubPat: githubAccessToken
//});

export const NO = "";
