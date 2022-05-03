import * as src from "./src";
import {LayerTwoExports} from "global/refs"

module.exports = {
    [LayerTwoExports.MonitoringNetworkId]: src.monitoring.network.id,
    [LayerTwoExports.PostgresHostname]: src.pg.hostname,
    [LayerTwoExports.PostgresNetworkId]: src.pg.networkId,
    [LayerTwoExports.PostgresUrl]: src.pg.url,
    [LayerTwoExports.InfrastructureVaultToken]: src.policies.infraToken.clientToken,
    [LayerTwoExports.PlatformVaultToken]: src.policies.platformToken.clientToken,
    [LayerTwoExports.InfluxDbToken]: src.monitoring.influx.credentials.password,
    [LayerTwoExports.MinioHostname]: src.minio.hostname,
    [LayerTwoExports.MinioUrl]: src.minio.url
}