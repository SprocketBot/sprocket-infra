import { SprocketStackDefinition } from "./types";

export enum LayerTwoExports {
  MonitoringNetworkId = "MonitoringNetworkId",
  PostgresHostname = "PostgresHostname",
  PostgresNetworkId = "PostgresNetworkId",
  PostgresUrl = "PostgresUrl",

  InfrastructureVaultToken = "InfrastructureVaultToken",
  PlatformVaultToken = "PlatformVaultToken",
  InfluxDbToken = "InfluxDbToken",
  MinioHostname = "MinioHostname",
  MinioUrl = "MinioUrl",

  N8nNetwork = "N8nNetworkId",
}

export default new SprocketStackDefinition(
  "layer_2",
  `${__dirname}/../../layer_2`,
);
