package broker

import (
	"context"
	"fmt"

	internaljwt "github.com/Kuadrant/mcp-gateway/internal/jwt"
	mcpotel "github.com/Kuadrant/mcp-gateway/internal/otel"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

const brokerTracerName = mcpotel.BrokerTracerName

var brokerComponentAttr = attribute.String("component", "mcp-broker")

func brokerTracer() trace.Tracer {
	return otel.Tracer(brokerTracerName)
}

// tracingMiddleware wraps each request in a span (replaces mark3labs'
// BeforeAny/OnSuccess/OnError hooks).
func (m *mcpBrokerImpl) tracingMiddleware() mcp.Middleware {
	return func(next mcp.MethodHandler) mcp.MethodHandler {
		return func(ctx context.Context, method string, req mcp.Request) (mcp.Result, error) {
			ctx, span := brokerTracer().Start(ctx, "mcp-broker.handle-request", trace.WithAttributes(
				brokerComponentAttr,
				attribute.String("mcp.method", method),
			))
			defer span.End()
			// LogSafeSessionID hashes/decodes per call; only pay for it when
			// the span is sampled
			if span.IsRecording() {
				if sess := req.GetSession(); sess != nil {
					if sid := sess.ID(); sid != "" {
						span.SetAttributes(attribute.String("mcp.session.id", internaljwt.LogSafeSessionID(sid)))
					}
				}
			}
			m.logger.DebugContext(ctx, "processing request", "method", method)

			result, err := next(ctx, method, req)
			if err != nil {
				m.logger.ErrorContext(ctx, "mcp server error", "method", method, "error", err)
				recordBrokerError(span, err)
			}
			return result, err
		}
	}
}

func recordBrokerError(span trace.Span, err error) {
	mcpotel.SpanError(span, err, err.Error())
	span.SetAttributes(
		attribute.String("error.type", fmt.Sprintf("%T", err)),
		attribute.String("error_source", "broker"),
	)
}
