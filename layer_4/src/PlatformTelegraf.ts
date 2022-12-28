import { Telegraf } from 'global/services/telegraf';
import { PlatformExports, Platforms } from 'global/refs';

import * as pulumi from '@pulumi/pulumi';
import * as vault from '@pulumi/vault';
import * as handlebars from "handlebars";
import { AllPlatformExports } from './constants';

function applyConfiguration(fileContent: string): pulumi.Output<string> {
  return pulumi.output(
    AllPlatformExports
  ).apply(cv => handlebars.compile(fileContent)({
    platforms: cv
  }));
}

export const PlatformTelegraf = (vaultProvider: vault.Provider,
                                 influxToken: pulumi.Output<string>,
                                 monitoringNetworkId: pulumi.Output<string>) =>
  new Telegraf('platform', {
    additionalEnvironmentVariables: {},
    additionalNetworkIds: AllPlatformExports.map(exports => exports.apply(e => e[PlatformExports.STACK_PLATFORM_NETWORK_ID]) as pulumi.Output<string>),
    configFilePath: `${__dirname}/config/telegraf/telegraf.conf`,
    configFileTransformation: applyConfiguration,
    influxToken,
    monitoringNetworkId,
    providers: { vault: vaultProvider }
  });
