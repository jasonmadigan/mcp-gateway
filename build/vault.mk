# Vault setup for MCP Gateway credential management

VAULT_NAMESPACE ?= vault-system
VAULT_VERSION ?= 0.28.1
HELM_REPO_HASHICORP ?= https://helm.releases.hashicorp.com

.PHONY: vault-install
vault-install-impl: ## Install Vault using Helm in dev mode
	@echo "========================================="
	@echo "Installing Vault $(VAULT_VERSION)"
	@echo "========================================="
	@echo ""

	# add hashicorp helm repository if not exists
	@helm repo list | grep -q "^hashicorp" || helm repo add hashicorp $(HELM_REPO_HASHICORP)
	@helm repo update hashicorp

	# create namespace
	@kubectl create namespace $(VAULT_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -

	# install vault in dev mode for testing
	@echo "Installing Vault in dev mode (insecure, for testing only)..."
	@helm upgrade --install vault hashicorp/vault \
		--namespace $(VAULT_NAMESPACE) \
		--version $(VAULT_VERSION) \
		--set "server.dev.enabled=true" \
		--set "server.dev.devRootToken=root" \
		--set "injector.enabled=false" \
		--set "ui.enabled=true" \
		--set "ui.serviceType=ClusterIP" \
		--wait

	@echo ""
	@echo "✅ Vault installed successfully in dev mode"
	@echo ""
	@echo "Root token: root"
	@echo "Vault UI will be available at: http://vault.$(VAULT_NAMESPACE).svc.cluster.local:8200"
	@echo ""
	@echo "To access Vault UI locally, run: make vault-forward"
	@echo "To configure Vault for MCP credentials, run: make vault-configure-mcp"

.PHONY: vault-install-prod
vault-install-prod-impl: ## Install Vault in production mode with auto-unseal
	@echo "========================================="
	@echo "Installing Vault $(VAULT_VERSION) (Production Mode)"
	@echo "========================================="
	@echo ""

	# add hashicorp helm repository if not exists
	@helm repo list | grep -q "^hashicorp" || helm repo add hashicorp $(HELM_REPO_HASHICORP)
	@helm repo update hashicorp

	# create namespace
	@kubectl create namespace $(VAULT_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -

	# install vault in production mode
	@echo "Installing Vault in production mode..."
	@helm upgrade --install vault hashicorp/vault \
		--namespace $(VAULT_NAMESPACE) \
		--version $(VAULT_VERSION) \
		--set "server.ha.enabled=true" \
		--set "server.ha.replicas=3" \
		--set "server.ha.raft.enabled=true" \
		--set "server.ha.raft.setNodeId=true" \
		--set "ui.enabled=true" \
		--set "ui.serviceType=ClusterIP" \
		--wait

	@echo ""
	@echo "✅ Vault installed in production mode"
	@echo "⚠️  Vault needs to be initialized and unsealed"
	@echo ""
	@echo "To initialize: kubectl exec -n $(VAULT_NAMESPACE) vault-0 -- vault operator init"
	@echo "To unseal: kubectl exec -n $(VAULT_NAMESPACE) vault-0 -- vault operator unseal <unseal-key>"

.PHONY: vault-forward
vault-forward-impl: ## Port forward Vault to localhost:8200
	@echo "Port forwarding Vault UI to http://localhost:8200"
	@echo "Root token (dev mode): root"
	@echo "Press Ctrl+C to stop..."
	@kubectl port-forward -n $(VAULT_NAMESPACE) svc/vault 8200:8200

.PHONY: vault-configure-mcp
vault-configure-mcp-impl: ## Configure Vault with MCP credential storage
	@echo "========================================="
	@echo "Configuring Vault for MCP Credentials"
	@echo "========================================="
	@echo ""

	# enable kv-v2 secrets engine at mcp/
	@echo "Enabling KV v2 secrets engine at mcp/..."
	@kubectl exec -n $(VAULT_NAMESPACE) vault-0 -- vault secrets enable -path=mcp kv-v2 2>/dev/null || \
		echo "KV v2 secrets engine already enabled at mcp/"

	# create example credentials
	@echo ""
	@echo "Creating example MCP credentials..."

	# github mcp token
	@kubectl exec -n $(VAULT_NAMESPACE) vault-0 -- vault kv put mcp/github \
		token="Bearer ghp_EXAMPLE_TOKEN" \
		description="GitHub MCP API Token" || true

	# slack token
	@kubectl exec -n $(VAULT_NAMESPACE) vault-0 -- vault kv put mcp/slack \
		token="Bearer xoxb-EXAMPLE_TOKEN" \
		description="Slack Bot Token" || true

	# api key for test server
	@kubectl exec -n $(VAULT_NAMESPACE) vault-0 -- vault kv put mcp/test-api-key \
		token="Bearer test-api-key-secret-token" \
		description="Test API Key Server Token" || true

	# create policy for reading mcp credentials
	@echo ""
	@echo "Creating Vault policy for MCP credential access..."
	@kubectl exec -n $(VAULT_NAMESPACE) vault-0 -- sh -c 'echo '\''path "mcp/data/*" { capabilities = ["read", "list"] } path "mcp/metadata/*" { capabilities = ["list"] }'\'' | vault policy write mcp-read -'

	# enable kubernetes auth
	@echo ""
	@echo "Enabling Kubernetes authentication..."
	@kubectl exec -n $(VAULT_NAMESPACE) vault-0 -- vault auth enable kubernetes 2>/dev/null || \
		echo "Kubernetes auth already enabled"

	# configure kubernetes auth
	@echo "Configuring Kubernetes authentication..."
	@kubectl exec -n $(VAULT_NAMESPACE) vault-0 -- sh -c 'vault write auth/kubernetes/config \
		kubernetes_host="https://$$KUBERNETES_PORT_443_TCP_ADDR:443"'

	# create role for mcp-controller
	@echo ""
	@echo "Creating Vault role for mcp-controller..."
	@kubectl exec -n $(VAULT_NAMESPACE) vault-0 -- vault write auth/kubernetes/role/mcp-controller \
		bound_service_account_names=mcp-controller \
		bound_service_account_namespaces=mcp-system \
		policies=mcp-read \
		ttl=24h

	@echo ""
	@echo "✅ Vault configured for MCP credentials"
	@echo ""
	@echo "Example credentials stored at:"
	@echo "  - mcp/github (GitHub token)"
	@echo "  - mcp/slack (Slack token)"
	@echo "  - mcp/test-api-key (Test server API key)"
	@echo ""
	@echo "To view a secret: kubectl exec -n $(VAULT_NAMESPACE) vault-0 -- vault kv get mcp/github"

.PHONY: vault-status
vault-status-impl: ## Show Vault status and stored credentials
	@echo "========================================="
	@echo "Vault Status"
	@echo "========================================="
	@echo ""

	# check if vault is installed
	@if kubectl get namespace $(VAULT_NAMESPACE) >/dev/null 2>&1; then \
		if kubectl get pods -n $(VAULT_NAMESPACE) -l app.kubernetes.io/name=vault >/dev/null 2>&1; then \
			echo "Vault pods:"; \
			kubectl get pods -n $(VAULT_NAMESPACE) -l app.kubernetes.io/name=vault; \
			echo ""; \
			echo "Vault status:"; \
			kubectl exec -n $(VAULT_NAMESPACE) vault-0 -- vault status 2>/dev/null || echo "Vault not initialized"; \
			echo ""; \
			echo "MCP credentials in Vault:"; \
			kubectl exec -n $(VAULT_NAMESPACE) vault-0 -- vault kv list mcp 2>/dev/null || echo "No credentials stored yet"; \
		else \
			echo "❌ Vault not installed"; \
			echo "Run: make vault-install"; \
		fi \
	else \
		echo "❌ Vault namespace not found"; \
		echo "Run: make vault-install"; \
	fi

.PHONY: vault-uninstall
vault-uninstall-impl: ## Uninstall Vault
	@echo "Uninstalling Vault..."
	@helm uninstall vault -n $(VAULT_NAMESPACE) 2>/dev/null || true
	@kubectl delete namespace $(VAULT_NAMESPACE) --ignore-not-found
	@echo "✅ Vault uninstalled"

.PHONY: vault-test-connection
vault-test-connection-impl: ## Test Vault connection and authentication
	@echo "========================================="
	@echo "Testing Vault Connection"
	@echo "========================================="
	@echo ""

	# create test service account
	@kubectl create serviceaccount vault-test -n mcp-system --dry-run=client -o yaml | kubectl apply -f -

	# get service account token
	@echo "Testing Kubernetes authentication..."
	@kubectl exec -n $(VAULT_NAMESPACE) vault-0 -- vault write auth/kubernetes/login \
		role=mcp-controller \
		jwt=$$(kubectl create token vault-test -n mcp-system) \
		2>/dev/null && echo "✅ Authentication successful" || echo "❌ Authentication failed"

	# cleanup
	@kubectl delete serviceaccount vault-test -n mcp-system --ignore-not-found

# add vault targets to main help
.PHONY: vault-install
vault-install: ## Install Vault for credential management
	@$(MAKE) -s vault-install-impl

.PHONY: vault-configure-mcp
vault-configure-mcp: ## Configure Vault with MCP credential storage
	@$(MAKE) -s vault-configure-mcp-impl

.PHONY: vault-forward
vault-forward: ## Port forward Vault UI to localhost:8200
	@$(MAKE) -s vault-forward-impl

.PHONY: vault-status
vault-status: ## Show Vault status and stored credentials
	@$(MAKE) -s vault-status-impl

.PHONY: vault-uninstall
vault-uninstall: ## Uninstall Vault from the cluster
	@$(MAKE) -s vault-uninstall-impl