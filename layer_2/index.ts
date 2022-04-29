import * as src from "./src";
import {LayerTwoExports} from "global/refs"
import {monitoring} from "./src";

module.exports = {
    [LayerTwoExports.MonitoringNetworkId]: src.monitoring.network.id,
    [LayerTwoExports.PostgresHostname]: src.pg.hostname,
    [LayerTwoExports.PostgresNetworkId]: src.pg.networkId,
    [LayerTwoExports.InfrastructureVaultToken]: src.policies.infraToken.clientToken,
    [LayerTwoExports.PlatformVaultToken]: src.policies.platformToken.clientToken,
    [LayerTwoExports.InfluxDbToken]: src.monitoring.influx.credentials.password
}