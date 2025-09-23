#!/bin/sh

apk update && apk add curl jq;

export VAULT_ADDR=http://localhost:8200
vault server --config /vault.hcl & server_pid=$!; echo "Server Starting";
while ! curl -s http://localhost:8200 > /dev/null 2>&1; do sleep 1; done
sleep 5  # Give Vault extra time to initialize internally

status=$(vault status -format=json)
echo "Vault status: $status"
sealed=$(echo "$status" | jq -r '.sealed')
initialized=$(echo "$status" | jq -r '.initialized')
echo "Sealed: $sealed"
echo "Initialized: $initialized"

# Diagnostic logs for lookup-self endpoint
if [ "$sealed" = "false" ] && [ "$initialized" = "true" ]; then
    echo "Testing /v1/auth/token/lookup-self endpoint with root token..."
    root_token=$(cat /vault/unseal-tokens/root_token.txt)
    export VAULT_TOKEN="$root_token"
    lookup_response=$(vault token lookup -format=json 2>&1)
    lookup_exit_code=$?
    echo "Lookup-self test exit code: $lookup_exit_code"
    echo "Lookup-self response: $lookup_response"
    if [ $lookup_exit_code -eq 0 ]; then
        echo "Lookup-self endpoint accessible with root token."
    else
        echo "Lookup-self endpoint failed with root token. Possible issue with permissions or auth method."
    fi
else
    echo "Vault not ready for endpoint testing (sealed or not initialized)."
fi

if [ "$sealed" = "true" ]; then
  if [ "$initialized" = "false" ] || [ ! -f /vault/unseal-tokens/unseal_tokens.txt ]; then
    echo "Initializing Vault"
    init_output=$(vault operator init 2>&1)
    exit_code=$?
    if [ $exit_code -ne 0 ]; then
      echo "Error initializing Vault: $init_output"
      exit 1
    fi
    echo "Init output: $init_output"
    echo "$init_output" | grep 'Unseal Key' | sed 's/.*: //' > /vault/unseal-tokens/unseal_tokens.txt
    echo "$init_output" | grep 'Initial Root Token' | sed 's/.*: //' > /vault/unseal-tokens/root_token.txt
    cat /vault/unseal-tokens/root_token.txt
    cat /vault/unseal-tokens/unseal_tokens.txt | while read -r t; do
      echo "Unsealing with key: $t"
      vault operator unseal "$t"
      sealed=$(vault status -format=json | jq -r '.sealed')
      if [ "$sealed" = "false" ]; then
        break
      fi
    done
  else
    if [ -f /vault/unseal-tokens/unseal_tokens.txt ]; then
      echo "Vault is initialized but sealed. Unsealing..."
      cat /vault/unseal-tokens/unseal_tokens.txt | while read -r t; do
        echo "Unsealing with key: $t"
        vault operator unseal "$t"
        sealed=$(vault status -format=json | jq -r '.sealed')
        if [ "$sealed" = "false" ]; then
          break
        fi
      done
    else
      echo "Error: unseal_tokens.txt not found. Vault must be reinitialized."
      exit 1
    fi
  fi
fi

echo "Done!"
wait $server_pid