import {Config} from "@pulumi/pulumi"

const c = new Config()
const environment = c.require("subdomain")


export const buildHost = (...x: string[]) => {
  if (environment === "main") {
    return x.filter(Boolean).filter(t => t !== environment).join('.');
  } return x.filter(Boolean).join('.');
}
