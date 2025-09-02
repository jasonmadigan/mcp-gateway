package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status
// +kubebuilder:resource:scope=Namespaced,shortName=mcpsrv

// MCPServer defines a collection of MCP (Model Context Protocol) servers to be aggregated by the gateway.
// It enables discovery and federation of tools from multiple backend MCP servers through HTTPRoute references,
// providing a declarative way to configure which MCP servers should be accessible through the gateway.
type MCPServer struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   MCPServerSpec   `json:"spec,omitempty"`
	Status MCPServerStatus `json:"status,omitempty"`
}

// MCPServerSpec defines the desired state of MCPServer.
// It specifies which HTTPRoutes point to MCP servers and how their tools should be federated.
type MCPServerSpec struct {
	// TargetRefs specifies HTTPRoutes that point to backend MCP servers.
	// Each referenced HTTPRoute should have backend services that implement the MCP protocol.
	// The controller will discover the backend services from these HTTPRoutes and configure
	// the broker to federate tools from those MCP servers.
	TargetRefs []TargetReference `json:"targetRefs"`

	// ToolPrefix is the default prefix to add to all federated tools from referenced servers.
	// This helps avoid naming conflicts when aggregating tools from multiple sources.
	// For example, if two servers both provide a 'search' tool, prefixes like 'server1_' and 'server2_'
	// ensure they can coexist as 'server1_search' and 'server2_search'.
	// Can be overridden per targetRef.
	// +optional
	ToolPrefix string `json:"toolPrefix,omitempty"`
}

// TargetReference identifies an HTTPRoute that points to MCP servers.
// It follows Gateway API patterns for cross-resource references.
type TargetReference struct {
	// Group is the group of the target resource.
	// +kubebuilder:default=gateway.networking.k8s.io
	// +kubebuilder:validation:Enum=gateway.networking.k8s.io
	Group string `json:"group"`

	// Kind is the kind of the target resource.
	// +kubebuilder:default=HTTPRoute
	// +kubebuilder:validation:Enum=HTTPRoute
	Kind string `json:"kind"`

	// Name is the name of the target resource.
	Name string `json:"name"`

	// Namespace of the target resource (optional, defaults to same namespace)
	// +optional
	Namespace string `json:"namespace,omitempty"`

	// ToolPrefix to use for this specific server (overrides spec-level toolPrefix)
	// +optional
	ToolPrefix string `json:"toolPrefix,omitempty"`
}

// MCPServerStatus represents the observed state of the MCPServer resource.
// It contains conditions that indicate whether the referenced servers have been
// successfully discovered and are ready for use.
type MCPServerStatus struct {
	// ObservedGeneration reflects the generation of the most recently observed MCPServer
	ObservedGeneration int64 `json:"observedGeneration,omitempty"`

	// Conditions represent the latest available observations of the MCPServer's state.
	// Types include: Ready, ServersDiscovered, ConfigMapUpdated
	Conditions []metav1.Condition `json:"conditions,omitempty"`

	// TotalServers is the total number of servers discovered
	TotalServers int `json:"totalServers,omitempty"`

	// TotalTools is the total number of tools discovered across all servers
	TotalTools int `json:"totalTools,omitempty"`

	// DiscoveredServers contains detailed information about each discovered server
	DiscoveredServers []DiscoveredServer `json:"discoveredServers,omitempty"`
}

// DiscoveredServer represents a discovered MCP server with its tools
type DiscoveredServer struct {
	// Name of the server (from HTTPRoute reference)
	Name string `json:"name"`

	// URL of the MCP server endpoint
	URL string `json:"url"`

	// ToolPrefix applied to this server's tools
	ToolPrefix string `json:"toolPrefix,omitempty"`

	// Ready indicates if this server is ready
	Ready bool `json:"ready"`

	// ToolCount is the number of tools discovered
	ToolCount int `json:"toolCount,omitempty"`

	// Tools lists the discovered tool names (without prefix)
	Tools []string `json:"tools,omitempty"`

	// LastProbeTime is when this server was last probed
	LastProbeTime *metav1.Time `json:"lastProbeTime,omitempty"`

	// Message provides additional information about the server status
	Message string `json:"message,omitempty"`
}

// +kubebuilder:object:root=true

// MCPServerList contains a list of MCPServer
type MCPServerList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []MCPServer `json:"items"`
}
