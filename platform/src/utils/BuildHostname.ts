import { BASE_HOSTNAME, config } from "@sprocketbot/infra-lib";
export const BuildHostname = (subdomain: string) => {
  return `${config.require<string>("subdomain")}.${BASE_HOSTNAME}`;
};
