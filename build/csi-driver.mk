# Secrets Store CSI Driver setup for Vault integration

CSI_DRIVER_VERSION ?= v1.4.5
CSI_DRIVER_NAMESPACE ?= kube-system
VAULT_CSI_PROVIDER_VERSION ?= 1.4.3

.PHONY: csi-driver-install
csi-driver-install-impl: ## Install Secrets Store CSI Driver and Vault provider
	@echo "========================================="
	@echo "Installing Secrets Store CSI Driver"
	@echo "========================================="
	@echo ""

	# install secrets store csi driver
	@echo "Installing Secrets Store CSI Driver $(CSI_DRIVER_VERSION)..."
	@kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/secrets-store-csi-driver/$(CSI_DRIVER_VERSION)/deploy/rbac-secretproviderclass.yaml
	@kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/secrets-store-csi-driver/$(CSI_DRIVER_VERSION)/deploy/csidriver.yaml
	@kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/secrets-store-csi-driver/$(CSI_DRIVER_VERSION)/deploy/secrets-store.csi.x-k8s.io_secretproviderclasses.yaml
	@kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/secrets-store-csi-driver/$(CSI_DRIVER_VERSION)/deploy/secrets-store.csi.x-k8s.io_secretproviderclasspodstatuses.yaml
	@kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/secrets-store-csi-driver/$(CSI_DRIVER_VERSION)/deploy/secrets-store-csi-driver.yaml

	# wait for csi driver to be ready
	@echo ""
	@echo "Waiting for CSI driver to be ready..."
	@sleep 5
	@kubectl wait --for=condition=ready pod -l app=csi-secrets-store -n $(CSI_DRIVER_NAMESPACE) --timeout=60s 2>/dev/null || echo "CSI driver starting..."

	# install vault csi provider using helm
	@echo ""
	@echo "Installing Vault CSI Provider..."
	@helm repo add secrets-store-csi-driver https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts 2>/dev/null || true
	@helm repo update
	@helm upgrade --install vault-csi-provider secrets-store-csi-driver/secrets-store-csi-driver-provider-vault \
		--namespace $(CSI_DRIVER_NAMESPACE) \
		--version $(VAULT_CSI_PROVIDER_VERSION) \
		--set "server.address=http://vault.vault-system.svc.cluster.local:8200" \
		--wait

	@echo ""
	@echo "✅ Secrets Store CSI Driver and Vault provider installed"
	@echo ""
	@echo "Next step: make csi-configure-mcp"

.PHONY: csi-configure-mcp
csi-configure-mcp-impl: ## Configure SecretProviderClass for MCP credentials
	@echo "========================================="
	@echo "Configuring CSI Driver for MCP"
	@echo "========================================="
	@echo ""

	# create secretproviderclass for mcp credentials
	@echo "Creating SecretProviderClass for MCP credentials..."
	@( echo "apiVersion: secrets-store.csi.x-k8s.io/v1"; \
	echo "kind: SecretProviderClass"; \
	echo "metadata:"; \
	echo "  name: mcp-vault-credentials"; \
	echo "  namespace: mcp-system"; \
	echo "spec:"; \
	echo "  provider: vault"; \
	echo "  parameters:"; \
	echo "    roleName: \"mcp-controller\""; \
	echo "    vaultAddress: \"http://vault.vault-system.svc.cluster.local:8200\""; \
	echo "    objects: |"; \
	echo "      - objectName: \"github-token\""; \
	echo "        secretPath: \"mcp/data/github\""; \
	echo "        secretKey: \"token\""; \
	echo "      - objectName: \"slack-token\""; \
	echo "        secretPath: \"mcp/data/slack\""; \
	echo "        secretKey: \"token\""; \
	echo "      - objectName: \"test-api-key\""; \
	echo "        secretPath: \"mcp/data/test-api-key\""; \
	echo "        secretKey: \"token\""; \
	echo "  secretObjects:"; \
	echo "  - secretName: mcp-aggregated-credentials-csi"; \
	echo "    type: Opaque"; \
	echo "    data:"; \
	echo "    - objectName: github-token"; \
	echo "      key: KAGENTAI_GITHUB_CRED"; \
	echo "    - objectName: slack-token"; \
	echo "      key: KAGENTAI_SLACK_CRED"; \
	echo "    - objectName: test-api-key"; \
	echo "      key: KAGENTAI_APIKEY_CRED" ) | kubectl apply -f -

	@echo ""
	@echo "✅ SecretProviderClass configured"
	@echo ""
	@echo "The broker deployment can now mount credentials directly from Vault!"
	@echo "Next step: make csi-patch-broker"

.PHONY: csi-patch-broker
csi-patch-broker-impl: ## Patch broker deployment to use CSI driver
	@echo "========================================="
	@echo "Patching Broker to use CSI Driver"
	@echo "========================================="
	@echo ""

	# patch the broker deployment to use csi volume
	@kubectl patch deployment mcp-broker-router -n mcp-system --type=json -p='[
	  {
	    "op": "add",
	    "path": "/spec/template/spec/volumes/-",
	    "value": {
	      "name": "vault-credentials",
	      "csi": {
	        "driver": "secrets-store.csi.k8s.io",
	        "readOnly": true,
	        "volumeAttributes": {
	          "secretProviderClass": "mcp-vault-credentials"
	        }
	      }
	    }
	  },
	  {
	    "op": "replace",
	    "path": "/spec/template/spec/containers/0/volumeMounts/0",
	    "value": {
	      "name": "vault-credentials",
	      "mountPath": "/etc/mcp-credentials",
	      "readOnly": true
	    }
	  }
	]' || echo "Failed to patch - deployment may need manual update"

	@echo ""
	@echo "Restarting broker to pick up CSI volume..."
	@kubectl rollout restart deployment/mcp-broker-router -n mcp-system
	@kubectl rollout status deployment/mcp-broker-router -n mcp-system --timeout=60s

	@echo ""
	@echo "✅ Broker configured to use CSI driver for Vault credentials"

.PHONY: csi-test
csi-test-impl: ## Test CSI driver Vault integration
	@echo "========================================="
	@echo "Testing CSI Driver Vault Integration"
	@echo "========================================="
	@echo ""

	# create a test pod to verify csi driver works
	@echo "Creating test pod with CSI volume..."
	@( echo "apiVersion: v1"; \
	echo "kind: Pod"; \
	echo "metadata:"; \
	echo "  name: csi-test-pod"; \
	echo "  namespace: mcp-system"; \
	echo "spec:"; \
	echo "  serviceAccountName: mcp-controller"; \
	echo "  containers:"; \
	echo "  - name: test"; \
	echo "    image: alpine:latest"; \
	echo "    command: [\"sleep\", \"3600\"]"; \
	echo "    volumeMounts:"; \
	echo "    - name: secrets"; \
	echo "      mountPath: /mnt/secrets"; \
	echo "      readOnly: true"; \
	echo "  volumes:"; \
	echo "  - name: secrets"; \
	echo "    csi:"; \
	echo "      driver: secrets-store.csi.k8s.io"; \
	echo "      readOnly: true"; \
	echo "      volumeAttributes:"; \
	echo "        secretProviderClass: mcp-vault-credentials" ) | kubectl apply -f -

	@echo ""
	@echo "Waiting for test pod to be ready..."
	@sleep 5
	@kubectl wait --for=condition=ready pod/csi-test-pod -n mcp-system --timeout=30s || true

	@echo ""
	@echo "Checking mounted secrets..."
	@kubectl exec -n mcp-system csi-test-pod -- ls -la /mnt/secrets/ || echo "Mount failed"
	@kubectl exec -n mcp-system csi-test-pod -- cat /mnt/secrets/test-api-key 2>/dev/null || echo "Secret not found"

	@echo ""
	@echo "Cleaning up test pod..."
	@kubectl delete pod csi-test-pod -n mcp-system --ignore-not-found

	@echo ""
	@echo "✅ CSI driver test complete"

.PHONY: csi-status
csi-status-impl: ## Show CSI driver and provider status
	@echo "========================================="
	@echo "CSI Driver Status"
	@echo "========================================="
	@echo ""

	@echo "CSI Driver pods:"
	@kubectl get pods -n $(CSI_DRIVER_NAMESPACE) -l app=secrets-store-csi-driver
	@echo ""

	@echo "Vault CSI Provider pods:"
	@kubectl get pods -n $(CSI_DRIVER_NAMESPACE) -l app.kubernetes.io/name=secrets-store-csi-driver-provider-vault
	@echo ""

	@echo "SecretProviderClasses:"
	@kubectl get secretproviderclass -A
	@echo ""

	@echo "CSI Driver info:"
	@kubectl get csidrivers secrets-store.csi.k8s.io -o yaml | grep -E "attachRequired|podInfoOnMount|volumeLifecycleModes" || true

.PHONY: csi-uninstall
csi-uninstall-impl: ## Uninstall CSI driver and provider
	@echo "Uninstalling CSI driver and Vault provider..."
	@helm uninstall vault-csi-provider -n $(CSI_DRIVER_NAMESPACE) 2>/dev/null || true
	@kubectl delete -f https://raw.githubusercontent.com/kubernetes-sigs/secrets-store-csi-driver/$(CSI_DRIVER_VERSION)/deploy/secrets-store-csi-driver.yaml --ignore-not-found
	@kubectl delete -f https://raw.githubusercontent.com/kubernetes-sigs/secrets-store-csi-driver/$(CSI_DRIVER_VERSION)/deploy/rbac-secretproviderclass.yaml --ignore-not-found
	@kubectl delete -f https://raw.githubusercontent.com/kubernetes-sigs/secrets-store-csi-driver/$(CSI_DRIVER_VERSION)/deploy/csidriver.yaml --ignore-not-found
	@kubectl delete crd secretproviderclasses.secrets-store.csi.x-k8s.io --ignore-not-found
	@kubectl delete crd secretproviderclasspodstatuses.secrets-store.csi.x-k8s.io --ignore-not-found
	@echo "✅ CSI driver uninstalled"

# add targets to main help
.PHONY: csi-driver-install
csi-driver-install: ## Install Secrets Store CSI Driver with Vault provider
	@$(MAKE) -s csi-driver-install-impl

.PHONY: csi-configure-mcp
csi-configure-mcp: ## Configure CSI driver for MCP credentials
	@$(MAKE) -s csi-configure-mcp-impl

.PHONY: csi-patch-broker
csi-patch-broker: ## Patch broker to use CSI driver volumes
	@$(MAKE) -s csi-patch-broker-impl

.PHONY: csi-test
csi-test: ## Test CSI driver Vault integration
	@$(MAKE) -s csi-test-impl

.PHONY: csi-status
csi-status: ## Show CSI driver status
	@$(MAKE) -s csi-status-impl

.PHONY: csi-uninstall
csi-uninstall: ## Uninstall CSI driver
	@$(MAKE) -s csi-uninstall-impl