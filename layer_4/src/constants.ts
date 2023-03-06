import * as pulumi from "@pulumi/pulumi"
import { PlatformExports, Platforms } from 'global/refs';

type IPlatformExports = Record<PlatformExports, string | pulumi.Output<string>> & { stack: string }
export const AllPlatformExports: pulumi.Output<IPlatformExports>[] =
  Object.entries(Platforms)
    .map(([k, p]) =>
      p.stack.outputs.apply<IPlatformExports>(o => ({ ...o, stack: k }) as IPlatformExports)
)




