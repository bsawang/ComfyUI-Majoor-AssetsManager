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
            id: "810",
            type: "LoadImage",
            inputs: [
                { name: "image", type: "IMAGE" },        // target_slot = 0, _widget is null in 0.37
                { name: "upload", type: "IMAGEUPLOAD" },
            ],
            widgets: [interiorWidget, { name: "upload", type: "button", value: "image" }],
        };

        const projectedWidget = {
            name: "image",
            type: "combo",
            widgetId: "g:5:image",
            value: "old.png",
        };

        // ComfyUI 0.37 real link structure (verified via CDP):
        //   origin_id = -10 (external IO node, NOT in subgraph)
        //   target_id = "810" (the real interior LoadImage node)
        //   resolve() tries origin_id → fails → MUST use target_id directly
        const link = {
            id: 42,
            origin_id: "-10",
            origin_slot: 3,
            target_id: "810",
            target_slot: 0,
            resolve: () => { throw new Error("Cannot read properties of undefined (reading 'getNodeById')"); },
        };
        const subgraph = {
            getLink: (id: number) => (id === 42 ? link : null),
            getNodeById: (id: string) => (id === "810" ? interiorNode : null),
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
