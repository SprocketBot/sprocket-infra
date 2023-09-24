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
