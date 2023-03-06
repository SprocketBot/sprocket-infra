import { LayerOne, LayerOneExports } from 'global/refs';
import { Gatus } from 'global/services/gatus';
import { HOSTNAME, UTIL_HOSTNAME } from 'global/constants';
import * as pulumi from '@pulumi/pulumi';
import { getDockerNodes } from './getDockerNodes';
import * as handlebars from 'handlebars';
import { AllPlatformExports } from './constants';

const ingressNetworkId = LayerOne.stack.requireOutput(LayerOneExports.IngressNetwork) as pulumi.Output<string>;

// TODO: Config File w/ Templating
// export const publicGatus = new Gatus('gatus-public', {
//   ingressNetworkId,
//   configFilePath: `${__dirname}/config/gatus/public.yml`,
//   hostname: HOSTNAME
// });
export const internalGatus = new Gatus('gatus-internal', {
  ingressNetworkId,
  configFilePath: `${__dirname}/config/gatus/private.yml`,
  hostname: UTIL_HOSTNAME,
  configFileTransformation: (fileContent: string) => {
    const template = handlebars.compile(fileContent);
    return pulumi.all([AllPlatformExports, getDockerNodes()]).apply(([platform, nodes]) => {
      return template({
        nodes,
        platform
      });
    });
  },
});
