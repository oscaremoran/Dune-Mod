// ==== Spice Exporter destination selection (power-node style) ====
// Tap an exporter, then tap a Core / Barracks / Spice Generator to link.
// Any other tap silently cancels.
const exporterLinks = {};   // exporterId -> {x, y}
let armedExporterId = -1;

function isValidDest(build) {
    if (build == null || build.block == null) return false;
    const name = build.block.name;
    if (name == null) return false;
    if (name.indexOf("core") !== -1) return true;
    return name === "dune-barracks"
        || name === "dune-spice-generator"
        || name === "dune-ornithopter-pad";
}

function currentDestFor(b) {
    const link = exporterLinks[b.id];
    if (link != null) {
        const t = Vars.world.tile(link.x, link.y);
        if (t != null && t.build != null && isValidDest(t.build) && t.build.team === b.team) {
            return t.build;
        }
    }
    return b.team.core();
}

Events.on(TapEvent, e => {
    const tile = e.tile;
    const build = (tile != null) ? tile.build : null;

    // Tapping an exporter arms it for linking
    if (build != null && build.block != null && build.block.name === "dune-spice-exporter") {
        armedExporterId = build.id;
        return;
    }

    // Armed: try to link to tapped destination; silently fail otherwise
    if (armedExporterId !== -1) {
        if (isValidDest(build)) {
            exporterLinks[armedExporterId] = {x: build.tile.x, y: build.tile.y};
        }
        armedExporterId = -1;
    }
});

// Routing loop
Events.run(Trigger.update, () => {
    if (!Vars.state.isGame()) return;
    const exporterBlock = Vars.content.getByName(ContentType.block, "dune-spice-exporter");
    if (exporterBlock == null) return;

    Groups.build.each(b => {
        if (b.block !== exporterBlock) return;
        if (b.items == null) return;

        const dest = currentDestFor(b);
        if (dest == null) return;

        const moves = [];
        b.items.each((item, amount) => {
            if (amount > 0) moves.push([item, amount]);
        });
        for (let i = 0; i < moves.length; i++) {
            const item = moves[i][0];
            const amount = moves[i][1];
            const accepts = dest.items != null && (dest.acceptItem == null || dest.acceptItem(b, item));
            if (accepts) {
                dest.items.add(item, amount);
                b.items.remove(item, amount);
            } else if (b.team.core() != null) {
                b.team.core().items.add(item, amount);
                b.items.remove(item, amount);
            }
        }
    });
});

// Draw brown routing line with a traveling spice dot for each exporter -> destination.
const LINE_COLOR = Color.valueOf("6b3a1a");
const SPICE_COLOR = Color.valueOf("ffbe5f");
const SPICE_TRAIL = Color.valueOf("dc7828");

Events.run(Trigger.draw, () => {
    if (!Vars.state.isGame()) return;
    const exporterBlock = Vars.content.getByName(ContentType.block, "dune-spice-exporter");
    if (exporterBlock == null) return;

    Groups.build.each(b => {
        if (b.block !== exporterBlock) return;
        const dest = currentDestFor(b);
        if (dest == null || dest === b) return;

        Draw.z(Layer.power);
        Draw.color(LINE_COLOR);
        Lines.stroke(1.5);
        Lines.line(b.x, b.y, dest.x, dest.y);

        // Traveling spice dot — 1.2s period per segment
        const dx = dest.x - b.x;
        const dy = dest.y - b.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const period = 72;
        const t = ((Time.time + b.id * 13) % period) / period;
        const px = b.x + dx * t;
        const py = b.y + dy * t;

        Draw.color(SPICE_TRAIL);
        Fill.circle(px, py, 2.5);
        Draw.color(SPICE_COLOR);
        Fill.circle(px, py, 1.5);
        Draw.reset();
    });
});

Events.on(ClientLoadEvent, () => {
    try {
        const wrap = new Table();
        wrap.setFillParent(true);
        wrap.top().right();

        const inner = new Table();
        const region = Core.atlas.find("dune-arrakis-planet-icon");
        inner.image(region).size(250, 250).pad(4);
        inner.row();
        const lbl = inner.add("[#c86b1f]ARRAKIS[]");
        try { lbl.style(Styles.outlineLabel); } catch (e) {}
        lbl.pad(4);

        wrap.add(inner).pad(20);
        Vars.ui.menuGroup.addChild(wrap);
    } catch (e) {
        Log.err("Dune menu icon failed: " + e);
    }

});
