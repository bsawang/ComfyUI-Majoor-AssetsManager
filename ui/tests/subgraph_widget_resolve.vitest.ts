import { describe, expect, it } from "vitest";

describe("resolveSubgraphInnerWidget", () => {
    it("returns null for non-subgraph nodes", async () => {
        const { resolveSubgraphInnerWidget } = await import("../features/dnd/canvasLoaderNode.js");
        const plainNode = {
            type: "LoadImage",
            isSubgraphNode: () => false,
            inputs: [],
        };
        expect(resolveSubgraphInnerWidget(plainNode, {})).toBeNull();
    });

    it("resolves the interior LoadImage widget behind a promoted subgraph widget", async () => {
        const { resolveSubgraphInnerWidget } = await import("../features/dnd/canvasLoaderNode.js");

        const interiorWidget = {
            name: "image",
            type: "combo",
            value: "old.png",
            setValue: () => {},
        };
        const interiorNode = {
            type: "LoadImage",
            inputs: [{ name: "image", type: "IMAGE", link: 42 }],
            getWidgetFromSlot: (slot: any) => (slot.link === 42 ? interiorWidget : undefined),
        };

        const projectedWidget = {
            name: "image",
            widgetId: "g:5:image",
            value: "old.png",
        };

        // The subgraph link chain: host input._subgraphSlot.linkIds → link 42 →
        // interior LoadImage input with link === 42.
        const link = {
            resolve: () => ({ inputNode: interiorNode }),
        };
        const subgraph = {
            getLink: (id: number) => (id === 42 ? link : null),
        };

        const subgraphNode = {
            type: "Subgraph",
            isSubgraphNode: () => true,
            subgraph,
            inputs: [
                {
                    name: "image",
                    widgetId: "g:5:image",
                    _widget: projectedWidget,
                    _subgraphSlot: { linkIds: [42] },
                },
            ],
        };

        const resolved = resolveSubgraphInnerWidget(subgraphNode, projectedWidget);
        expect(resolved).toBe(interiorWidget);
    });

    it("returns null when the projected widget matches no host input", async () => {
        const { resolveSubgraphInnerWidget } = await import("../features/dnd/canvasLoaderNode.js");
        const subgraphNode = {
            type: "Subgraph",
            isSubgraphNode: () => true,
            subgraph: { getLink: () => null },
            inputs: [],
        };
        expect(resolveSubgraphInnerWidget(subgraphNode, { widgetId: "g:9:other" })).toBeNull();
    });

    it("falls back to the host widget when no interior widget can be resolved", async () => {
        const { resolveSubgraphInnerWidget } = await import("../features/dnd/canvasLoaderNode.js");
        const projectedWidget = { name: "image", widgetId: "g:7:image" };
        const subgraphNode = {
            type: "Subgraph",
            isSubgraphNode: () => true,
            subgraph: { getLink: () => null },
            inputs: [
                {
                    name: "image",
                    widgetId: "g:7:image",
                    _widget: projectedWidget,
                    _subgraphSlot: { linkIds: [99] }, // link missing → nothing resolved
                },
            ],
        };
        const resolved = resolveSubgraphInnerWidget(subgraphNode, projectedWidget);
        // Interior link unresolved → fall back to the host projected widget itself.
        expect(resolved).toBeNull();
    });
});
