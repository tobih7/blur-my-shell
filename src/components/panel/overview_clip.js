import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { Connections } from '../../conveniences/connections.js';

// The workspace preview's shadow can reach under a transparent panel as the overview closes.
// Clip its paint rather than changing the theme or restoring panel blur over the overview backdrop.
const WorkspacePanelClip = GObject.registerClass({
    GTypeName: 'BmsWorkspacePanelClip',
}, class WorkspacePanelClip extends Clutter.Effect {
    _init(panel_blur, monitor_index) {
        super._init();
        this.panel_blur = panel_blur;
        this.monitor_index = monitor_index;
    }

    vfunc_paint_node(node) {
        const actor = this.get_actor();
        const monitor = Main.layoutManager.monitors[this.monitor_index];
        let parent = node;

        if (monitor && this.panel_blur.settings.panel.UNBLUR_IN_OVERVIEW) {
            let left = monitor.x;
            let top = monitor.y;
            let right = left + monitor.width;
            let bottom = top + monitor.height;
            let clipped = false;

            for (const { widgets } of this.panel_blur.actors_list) {
                const { panel, background } = widgets;
                if (background.visible || !panel.mapped || !panel.get_paint_opacity())
                    continue;

                const [x, y] = panel.get_transformed_position();
                const [width, height] = panel.get_transformed_size();
                if (width <= 0 || height <= 0 || x >= monitor.x + monitor.width ||
                    y >= monitor.y + monitor.height || x + width <= monitor.x ||
                    y + height <= monitor.y)
                    continue;

                // Follow the visible panel, including panels sliding offscreen or placed on
                // another edge by Dash to Panel. Coordinates are logical, so scaling is preserved.
                if (width >= height) {
                    if (y + height / 2 < monitor.y + monitor.height / 2)
                        top = Math.max(top, y + height);
                    else
                        bottom = Math.min(bottom, y);
                } else if (x + width / 2 < monitor.x + monitor.width / 2) {
                    left = Math.max(left, x + width);
                } else {
                    right = Math.min(right, x);
                }
                clipped = true;
            }

            if (clipped) {
                const [ok1, x1, y1] = actor.transform_stage_point(left, top);
                const [ok2, x2, y2] = actor.transform_stage_point(right, bottom);
                if (ok1 && ok2) {
                    if (x2 <= x1 || y2 <= y1)
                        return;
                    parent = new Clutter.ClipNode();
                    parent.add_rectangle(new Clutter.ActorBox({ x1, y1, x2, y2 }));
                    node.add_child(parent);
                }
            }
        }

        parent.add_child(new Clutter.ActorNode(actor, -1));
    }
});

export class PanelOverviewClip {
    constructor(panel_blur) {
        this.panel_blur = panel_blur;
        this.connections = new Connections();
        this.effects = new Map();
        this.watched_displays = new WeakSet();
        this.update_id = 0;
    }

    enable() {
        this.connections.connect(Main.overview, 'showing', () => this.update());
        this.connections.connect(Main.layoutManager, 'monitors-changed', () => this.queue_update());
        this.connections.connect(global.workspace_manager, 'notify::n-workspaces', () => this.queue_update());
        this.connections.connect(Main.layoutManager.overviewGroup, 'child-added', () => this.queue_update());
        this.update();
    }

    queue_update() {
        if (this.update_id)
            return;
        this.update_id = global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
            this.update_id = 0;
            this.update();
            return GLib.SOURCE_REMOVE;
        });
    }

    update() {
        const display = Main.overview._overview?.controls?._workspacesDisplay;
        for (const monitor_display of display?._workspacesViews ?? []) {
            // Secondary monitors can replace their inner view when workspace settings change.
            if (!this.watched_displays.has(monitor_display)) {
                this.watched_displays.add(monitor_display);
                this.connections.connect(monitor_display, 'child-added', () => this.queue_update());
            }
            const view = monitor_display._workspacesView ?? monitor_display;
            for (const workspace of view._workspaces ?? [view._workspace]) {
                const background = workspace?._background;
                if (!background || this.effects.has(background))
                    continue;

                const effect = new WorkspacePanelClip(this.panel_blur, background._monitorIndex);
                background.add_effect(effect);
                this.effects.set(background, effect);
                this.connections.connect(background, 'destroy', () => this.effects.delete(background));
            }
        }
    }

    disable() {
        if (this.update_id) {
            global.compositor.get_laters().remove(this.update_id);
            this.update_id = 0;
        }
        this.connections.disconnect_all();
        for (const [actor, effect] of this.effects)
            actor.remove_effect(effect);
        this.effects.clear();
        this.watched_displays = new WeakSet();
    }
}
