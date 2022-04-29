import {SprocketStackDefinition} from "./types";


export enum LayerTwoExports {
    MonitoringNetworkId = "MonitoringNetworkId",
    PostgresHostname = "PostgresHostname",
    PostgresNetworkId = "PostgresNetworkId",
    InfrastructureVaultToken = "InfrastructureVaultToken",
    PlatformVaultToken = "PlatformVaultToken",
    InfluxDbToken = "InfluxDbToken"
}

export default new SprocketStackDefinition("layer_2", `${__dirname}/../../layer_2`);