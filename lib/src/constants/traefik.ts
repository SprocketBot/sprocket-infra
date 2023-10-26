export enum EntryPoint {
  HTTP = `web`,
  HTTPS = "websecure",
}

export enum ForwardAuthRule {
  ANYBODY = "fa-everyone",
  ADMINS = "fa-admins",
  STAFF = "fa-sprocket-staff",
  DEVS = "fa-sprocket-devs",
  ALPHA = "fa-sprocket-alpha",
  ELO = "fa-sprocket-elo",
  DATA = "fa-data-team",
  DATA_LEAD = "fa-data-lead",
  TEAM_LEAD = "fa-team-leads"
}
export enum CertResolver {
  TLS = "lets-encrypt-tls",
  DNS = "lets-encrypt-dns",
}
