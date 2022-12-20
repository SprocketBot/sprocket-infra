import { SprocketStackDefinition } from './types';

export enum PlatformExports {
  WEB_SERVICE_NAME = "WebServiceName",
  WEB_HOSTNAME = "WebHostname",

  CORE_SERVICE_NAME = "CoreServiceName",
  CORE_HOSTNAME = "CoreHostname",

  REDIS_SERVICE_NAME = "RedisServiceName",
  REDIS_PASSWORD = "RedisPassword",
  RMQ_SERVICE_NAME = "RmqServiceName",

  STACK_ROOT_HOSTNAME = "StackRootHostname",
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
