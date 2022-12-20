import { SprocketStackDefinition } from './types';

export enum PlatformExports {
  WEB_SERVICE_NAME = "WebServiceName",
  STACK_ROOT_DNS = "Dns",
  CORE_SERVICE_NAME = "CoreServiceName",
}

export enum PlatformStacks {
  DEV = 'dev',
  STAGING = 'staging',
  MAIN = 'main'
}

export const Platforms: Record<PlatformStacks, SprocketStackDefinition> = {
  [PlatformStacks.DEV]: new SprocketStackDefinition(PlatformStacks.DEV, `${__dirname}/../../platform`),
  [PlatformStacks.STAGING]: new SprocketStackDefinition(PlatformStacks.STAGING, `${__dirname}/../../platform`),
  [PlatformStacks.MAIN]: new SprocketStackDefinition(PlatformStacks.MAIN, `${__dirname}/../../platform`)
}
