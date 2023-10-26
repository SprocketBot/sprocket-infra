import { ConfigFile } from "@sprocketbot/infra-lib";

export const grafanaConfig = new ConfigFile("grafana-cfg", {
  filepath: "./src/config/grafana.hbs.ini",
  vars: {
    name: null,
    hostname: null,
    db: {
      host: null,
      name: null,
      username: null,
      password: null,
    },
  },
});
