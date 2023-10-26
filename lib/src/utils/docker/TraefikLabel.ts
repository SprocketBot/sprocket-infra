import * as docker from "@pulumi/docker";
import {
  CertResolver,
  config,
  EntryPoint,
  ForwardAuthRule,
} from "../../constants";

abstract class TraefikLabel {
  protected output: docker.types.input.ServiceLabel[] = [
    {
      label: "traefik.enable",
      value: "true",
    },
  ];

  get complete() {
    return this.output;
  }

  constructor(readonly name: string) {}

  protected abstract routerPrefix: string;
  protected abstract servicePrefix: string;
  protected abstract middlewarePrefix: string;

  protected routerLabel(
    key: string,
    value: string,
  ): docker.types.input.ServiceLabel {
    return { label: `${this.routerPrefix}.${key}`, value };
  }

  protected serviceLabel(
    key: string,
    value: string,
  ): docker.types.input.ServiceLabel {
    return { label: `${this.servicePrefix}.${key}`, value };
  }

  protected middlewareLabel(
    key: string,
    value: string,
  ): docker.types.input.ServiceLabel {
    return { label: `${this.middlewarePrefix}.${key}`, value };
  }

  rule(rule: string) {
    this.output.push(this.routerLabel("rule", rule));
    return this;
  }

  service(service: string) {
    this.output.push(this.routerLabel("service", service));
    return this;
  }
  entryPoints(entryPoints: EntryPoint | EntryPoint[]) {
    this.output.push(
      this.routerLabel(
        "entryPoints",
        Array.isArray(entryPoints) ? entryPoints.join(",") : entryPoints,
      ),
    );
    return this;
  }
  targetPort(port: number) {
    this.output.push(
      this.serviceLabel("loadbalancer.server.port", port.toString()),
    );
    return this;
  }

  // TODO: CertResolver -> Enum
  tls(certResolver: CertResolver, wildcardRoot: string | false = false) {
    this.output.push(this.routerLabel("tls", "true"));
    if (config.getBoolean("no-tls")) return this;
    this.output.push(this.routerLabel("tls.certResolver", certResolver));
    if (wildcardRoot) {
      this.output.push(this.routerLabel(`tls.domains[0].main`, wildcardRoot));
      this.output.push(
        this.routerLabel(`tls.domains[0].sans`, `*.${wildcardRoot}`),
      );
    }
    return this;
  }
}

export class TraefikHttpLabel extends TraefikLabel {
  protected readonly routerPrefix = `traefik.http.routers.${this.name}`;
  protected readonly servicePrefix = `traefik.http.services.${this.name}`;
  protected readonly middlewarePrefix = `traefik.http.middlewares.${this.name}`;

  forwardAuthRule(ruleName: ForwardAuthRule) {
    this.output.push(this.routerLabel("middlewares", `${ruleName}@file`));

    return this;
  }
}

export class TraefikTcpLabel extends TraefikLabel {
  protected readonly routerPrefix = `traefik.tcp.routers.${this.name}`;
  protected readonly servicePrefix = `traefik.tcp.services.${this.name}`;
  protected readonly middlewarePrefix = `traefik.tcp.middlewares.${this.name}`;
}
