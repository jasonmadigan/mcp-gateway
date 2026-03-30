# Inspection & URLs

open := $(shell { which xdg-open || which open; } 2>/dev/null)

# generic template for inspecting MCP servers via temporary external httproute
# args: $(1) = server name, $(2) = hostname slug, $(3) = service name, $(4) = service port, $(5) = mcp path, $(6) = tools description, $(7) = extra notes
define inspect-server-template
	@ROUTE_NAME=$(2)-inspect-route; \
		trap "echo 'Cleaning up HTTPRoute...'; kubectl delete httproute -n mcp-test $$ROUTE_NAME 2>/dev/null || true" EXIT INT TERM; \
		echo "Creating temporary HTTPRoute for $(1)..." && \
		echo '{"apiVersion":"gateway.networking.k8s.io/v1","kind":"HTTPRoute","metadata":{"name":"'$$ROUTE_NAME'","labels":{"mcp-inspect":"true"}},"spec":{"parentRefs":[{"name":"mcp-gateway","namespace":"gateway-system"}],"hostnames":["$(2).127-0-0-1.sslip.io"],"rules":[{"matches":[{"path":{"type":"PathPrefix","value":"/"}}],"backendRefs":[{"name":"$(3)","port":$(4)}]}]}}' | kubectl apply -n mcp-test -f - && \
		echo "Waiting for HTTPRoute to be accepted..." && \
		kubectl wait -n mcp-test httproute/$$ROUTE_NAME --for=jsonpath='{.status.parents[0].conditions[?(@.type=="Accepted")].status}'=True --timeout=30s && \
		echo "Opening MCP Inspector for $(1) at http://$(2).127-0-0-1.sslip.io:$(KIND_HOST_PORT_MCP_GATEWAY)$(5)" && \
		echo "Available tools: $(6)" && \
		$(if $(7),echo "$(7)" &&) \
		echo "" && \
		MCP_AUTO_OPEN_ENABLED=false DANGEROUSLY_OMIT_AUTH=true npx @modelcontextprotocol/inspector@latest & \
		sleep 2; \
		$(open) "http://localhost:6274/?transport=streamable-http&serverUrl=http://$(2).127-0-0-1.sslip.io:$(KIND_HOST_PORT_MCP_GATEWAY)$(5)"; \
		echo "Press Ctrl+C to stop and cleanup"; \
		wait
endef

# URLs for services
urls-impl:
	@echo "=== MCP Gateway URLs ==="
	@echo "Gateway: http://mcp.127-0-0-1.sslip.io:$(KIND_HOST_PORT_MCP_GATEWAY)"
	@echo "Keycloak: https://keycloak.127-0-0-1.sslip.io:$(KIND_HOST_PORT_KEYCLOAK)"

##@ Inspection

.PHONY: inspect-server1
inspect-server1: ## Open MCP Inspector for test server 1
	$(call inspect-server-template,test server 1,server1,mcp-test-server1,9090,/mcp,hi time slow headers)

.PHONY: inspect-server2
inspect-server2: ## Open MCP Inspector for test server 2
	$(call inspect-server-template,test server 2,server2,mcp-test-server2,9090,/mcp,hello_world time headers auth1234 slow)

.PHONY: inspect-server3
inspect-server3: ## Open MCP Inspector for test server 3
	$(call inspect-server-template,test server 3,server3,mcp-test-server3,9090,/mcp,time add dozen pi get_weather slow)

.PHONY: inspect-api-key-server
inspect-api-key-server: ## Open MCP Inspector for API key test server (requires auth)
	$(call inspect-server-template,API key test server,api-key-server,mcp-api-key-server,9090,/mcp,hello_world,NOTE: This server requires Bearer token authentication)

.PHONY: inspect-custom-path
inspect-custom-path: ## Open MCP Inspector for custom path server
	$(call inspect-server-template,custom path server,custom-path,mcp-custom-path-server,8080,/v1/special/mcp,echo_custom path_info timestamp,NOTE: This server uses a custom path /v1/special/mcp instead of /mcp)

.PHONY: inspect-oidc-server
inspect-oidc-server: ## Open MCP Inspector for OpenID Connect test server (requires auth)
	$(call inspect-server-template,OIDC test server,oidc-server,mcp-oidc-server,9090,/mcp,hello_world,NOTE: This server requires OIDC Bearer token authentication)

.PHONY: inspect-everything-server
inspect-everything-server: ## Open MCP Inspector for test everything server
	$(call inspect-server-template,test everything server,everything-server,everything-server,9090,/mcp,echo add longRunningOperation printEnv sampleLLM getTinyImage annotatedMessage getResourceReference startElicitation structuredContent listRoots)

.PHONY: uninspect
uninspect: ## Remove any leftover inspect HTTPRoutes
	@echo "Removing inspect HTTPRoutes..."
	@kubectl delete httproute -n mcp-test -l mcp-inspect=true 2>/dev/null || echo "No inspect HTTPRoutes found"

# Legacy alias for compatibility
inspect-mock-impl: inspect-server1

# Open MCP Inspector for gateway (broker via gateway)
.PHONY: inspect-gateway
inspect-gateway: ## Open MCP Inspector for the gateway
	@echo "Opening MCP Inspector for gateway"; \
	echo "URL: http://mcp.127-0-0-1.sslip.io:$(KIND_HOST_PORT_MCP_GATEWAY)/mcp"; \
	echo ""; \
	MCP_AUTO_OPEN_ENABLED=false DANGEROUSLY_OMIT_AUTH=true npx @modelcontextprotocol/inspector@latest & \
	sleep 2; \
	$(open) "http://localhost:6274/?transport=streamable-http&serverUrl=http://mcp.127-0-0-1.sslip.io:$(KIND_HOST_PORT_MCP_GATEWAY)/mcp"; \
	echo "Press Ctrl+C to stop and cleanup"; \
	wait

# Show status of all MCP components implementation
status-impl:
	@echo "=== Cluster Components ==="
	@kubectl get pods -n istio-system | grep -E "(istiod|sail)" || echo "Istio: Not found"
	@kubectl get pods -n gateway-system | grep gateway || echo "Gateway: Not found"
	@kubectl get pods -n mcp-system 2>/dev/null || echo "MCP System: No pods"
	@kubectl get pods -n mcp-server 2>/dev/null || echo "Mock MCP: No pods"
	@echo ""
	@echo "=== Local Processes ==="
	@lsof -i :8080 | grep LISTEN | head -1 || echo "Broker: Not running (port 8080)"
	@lsof -i :9002 | grep LISTEN | head -1 || echo "Router: Not running (port 9002)"
	@echo ""
	@echo "=== Port Forwards ==="
	@ps aux | grep -E "kubectl.*port-forward" | grep -v grep || echo "No active port-forwards"
