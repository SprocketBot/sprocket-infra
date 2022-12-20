import {PlatformExports} from "global/refs"
import * as pulumi from "@pulumi/pulumi"
import * as resources from "./src"


const e: Record<PlatformExports, string | pulumi.Output<string>> = {
  CoreHostname: resources.platform.apiUrl,
  CoreServiceName: resources.platform.core.hostname,
  RedisServiceName: resources.platform.datastore.redis.hostname,
  RmqServiceName: resources.platform.datastore.rabbitmq.hostname,
  StackRootHostname: resources.platform.webUrl,
  WebHostname: resources.platform.webUrl,
  WebServiceName: resources.platform.clients.web.hostname
}

module.exports = e
