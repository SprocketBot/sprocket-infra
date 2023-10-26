pulumi state unprotect 'urn:pulumi:infra::SprocketInfrastructure::SprocketBot:LogicalGroup:deployed-vault$SprocketBot:Service:Vault$SprocketBot:OneOff:VaultAutoInitializer$docker:index/container:Container::unseal-0'
pulumi state unprotect 'urn:pulumi:infra::SprocketInfrastructure::SprocketBot:LogicalGroup:deployed-vault$SprocketBot:Service:Vault$SprocketBot:OneOff:VaultAutoInitializer$docker:index/container:Container::unseal-1'
pulumi state unprotect 'urn:pulumi:infra::SprocketInfrastructure::SprocketBot:LogicalGroup:deployed-vault$SprocketBot:Service:Vault$SprocketBot:OneOff:VaultAutoInitializer$docker:index/container:Container::init'
pulumi destroy -y --skip-preview
#mc rm -r myhl/vault/vault_storage --force