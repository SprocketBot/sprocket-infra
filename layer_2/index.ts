import * as src from "./src";
import { LayerTwoExports } from "global/refs"
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();

module.exports = {
    [LayerTwoExports.MonitoringNetworkId]: src.monitoring.network.id,
    [LayerTwoExports.PostgresHostname]: src.pg.hostname,
    [LayerTwoExports.PostgresNetworkId]: src.pg.networkId,
    [LayerTwoExports.PostgresUrl]: src.pg.url,
    [LayerTwoExports.InfrastructureVaultToken]: src.policies.infraToken.clientToken,
    [LayerTwoExports.PlatformVaultToken]: src.policies.platformToken.clientToken,
    [LayerTwoExports.InfluxDbToken]: src.monitoring.influx.credentials.password,
    [LayerTwoExports.MinioHostname]: config.require('s3-endpoint'),
    [LayerTwoExports.MinioUrl]: config.require('s3-endpoint'),
    // [LayerTwoExports.N8nNetwork]: src.n8n.network.id
}
