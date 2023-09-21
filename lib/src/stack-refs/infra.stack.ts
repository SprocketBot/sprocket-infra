import * as pulumi from "@pulumi/pulumi";
import { WithOverrides } from "../types";

export enum InfrastructureStackOutputs {
  VaultHostname = "VaultHostname",
  VaultApproleSecretId = "VaultApproleSecretId",
  VaultApproleRoleId = "VaultApproleRoleId",
  IngressNetworkId = "IngressNetworkId",
  MonitoringNetworkId = "MonitoringNetworkId",

  PostgresNetworkId = "PostgresNetworkId",
  PostgresInternalHostname = "PostgresInternalHostname",
  PostgresExternalHostname = "PostgresExternalHostname",
  PostgresVaultConnectionName = "PostgresVaultConnectionName",
  PostgresVaultRootRolePath = "PostgresVaultRootRolePath",

  LokiUrl = "LokiUrl",

  InfluxUrl = "InfluxUrl",
  InfluxInternalHostname = "InfluxInternalHostname",
  InfluxAdminToken = "InfluxAdminToken",
}

// This might look a little scary; but this is a type-safe way for us to extend StackReference
// While also changing the signature of a few functions.

class InfrastructureStack extends WithOverrides(pulumi.StackReference, [
  "getOutput",
  "getOutputValue",
]) {
  getOutput = <T = string>(
    name: pulumi.Input<InfrastructureStackOutputs>,
  ): pulumi.Output<T> =>
    pulumi.StackReference.prototype.getOutput.call(
      this,
      name as string,
    ) as pulumi.Output<T>;

  getOutputValue = <T = string>(
    name: pulumi.Input<InfrastructureStackOutputs>,
  ): Promise<T> =>
    pulumi.StackReference.prototype.getOutputValue.call(
      this,
      name as string,
    ) as Promise<T>;
}

export const InfrastructureStackRef =
  pulumi.getStack() === "infra"
    ? null
    : new InfrastructureStack("infrastructure-stack-ref", {
        name: "ItsMeBrianD/SprocketInfrastructure/infra", // TOOD: Make this configurable
      });
