#!/bin/sh

apk add curl jq;

export VAULT_ADDR=http://localhost:8200
vault server --config /vault.hcl & echo "Server Starting";
sleep 5

vault_configured=$(vault status | grep Initialized | sed 's/^Initialized[ ]*//')
if [ "$vault_configured" == "false" ]; then
  echo "Initializing Vault"

  # If the vault has not been stood up, initialize it
  vault operator init > top_sneaky

  # Parse the output into the root token and the unseal tokens
  grep 'Initial Root Token: ' top_sneaky | sed 's/^.*: //' > root_token.txt
  grep 'Unseal Key ' top_sneaky | sed 's/^.*: //' > unseal_tokens.txt

  # Remove the temp file
  rm top_sneaky;

  # Unseal the vault
  cat unseal_token | while read -r t; do
    result=$(vault operator unseal "$t" | grep Sealed)
    # Check if the vault has been successfully unsealed
    if [ $(vault status | grep Sealed | sed 's/^Sealed[ ]*//') == "false" ]; then
      break;
    fi;
  done;

  # If the vault is sealed... ???
elif [ $(vault status | grep Sealed | sed 's/^Sealed[ ]*//') == "true" ]; then
  echo "Vault is sealed!"
fi;


echo "Done!"