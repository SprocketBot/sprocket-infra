import { Platform } from "./Platform";
import {
  getGrafanaProvider,
  getPostgresProvider,
  getVaultProvider,
  InfrastructureStackOutputs,
  InfrastructureStackRef,
} from "@sprocketbot/infra-lib";

if (InfrastructureStackRef === null)
  throw new Error("InfrastructureStackRef is null");

const p = new Platform(
  "platform",
  {
    vaultConnName: InfrastructureStackRef.getOutput(
      InfrastructureStackOutputs.PostgresVaultConnectionName,
    ),
    ingressNetworkId: InfrastructureStackRef.getOutput(
      InfrastructureStackOutputs.IngressNetworkId,
    ),
    monitoringNetworkId: InfrastructureStackRef.getOutput(
      InfrastructureStackOutputs.MonitoringNetworkId,
    ),
  },
  {
    providers: [
      getVaultProvider(),
      getPostgresProvider(),
      getGrafanaProvider(),
    ],
  },
);

export const X = "";
