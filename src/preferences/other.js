import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';


export const Other = GObject.registerClass({
    GTypeName: 'Other',
    Template: GLib.uri_resolve_relative(import.meta.url, '../ui/other.ui', GLib.UriFlags.NONE),
    InternalChildren: [
        'lockscreen_blur',
        'lockscreen_pipeline_choose_row',

        'screenshot_blur',
        'screenshot_pipeline_choose_row',

        'window_list_blur',
        'window_list_pipeline_choose_row',

        'coverflow_alt_tab_blur',
        'coverflow_alt_tab_pipeline_choose_row',

        'debug',
        'reset',
        'reset_all_row',
        'reset_sections'
    ],
}, class Other extends Adw.PreferencesPage {
    constructor(preferences, pipelines_manager, pipelines_page) {
        super({});

        this.preferences = preferences;
        this.pipelines_manager = pipelines_manager;
        this.pipelines_page = pipelines_page;

        this.preferences.lockscreen.settings.bind(
            'blur', this._lockscreen_blur, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._lockscreen_pipeline_choose_row.initialize(
            this.preferences.lockscreen, this.pipelines_manager, this.pipelines_page
        );

        this.preferences.screenshot.settings.bind(
            'blur', this._screenshot_blur, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._screenshot_pipeline_choose_row.initialize(
            this.preferences.screenshot, this.pipelines_manager, this.pipelines_page
        );

        this.preferences.window_list.settings.bind(
            'blur', this._window_list_blur, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this._window_list_pipeline_choose_row.initialize(
            this.preferences.window_list, this.pipelines_manager, this.pipelines_page
        );

        this.preferences.coverflow_alt_tab.settings.bind(
            'blur', this._coverflow_alt_tab_blur, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this._coverflow_alt_tab_pipeline_choose_row.initialize(
            this.preferences.coverflow_alt_tab, this.pipelines_manager, this.pipelines_page
        );

        this.preferences.settings.bind(
            'debug', this._debug, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._reset.connect('clicked', () => this.confirm_reset());
        this.add_section_resets();
    }

    add_section_resets() {
        const sections = [
            ['pipelines', _('Pipelines'), _('Removes custom pipelines.')],
            ['panel', _('Panel'), ''],
            ['overview', _('Overview'), ''],
            ['dash', _('Dash'), ''],
            ['applications', _('Applications'), _('Keeps application lists.')],
            ['application-lists', _('Applications Whitelist and Blacklist'), _('Keeps application settings.')],
            ['popup', _('Popups'), ''],
            ['other', _('Other'), ''],
        ];
        for (const [section, title, subtitle] of sections) {
            const row = new Adw.ActionRow({ title, subtitle });
            const button = new Gtk.Button({
                valign: Gtk.Align.CENTER,
                child: new Adw.ButtonContent({
                    icon_name: 'reset-symbolic',
                    label: _('Reset'),
                }),
            });
            button.add_css_class('destructive-action');
            row.add_suffix(button);
            row.activatable_widget = button;
            button.connect('clicked', () => this.confirm_reset(section, title));
            this._reset_sections.add_row(row);
        }
    }

    reset_preferences(section = null) {
        const reset = section === null
            ? this.preferences.reset()
            : this.preferences.reset_section(section);
        if (!reset) {
            const dialog = new Adw.AlertDialog({
                heading: _('Unable to reset preferences'),
                body: _('Some settings are locked. Nothing was reset.'),
            });
            dialog.add_response('close', _('Close'));
            dialog.set_close_response('close');
            dialog.present(this);
        }
    }

    confirm_reset(section = null, title = null) {
        let heading = section === null
            ? _('Reset all preferences?')
            : _('Reset “%s”?').format(title);
        let body = section === null
            ? _('All preferences will return to their defaults.')
            : _('This section will return to its defaults.');
        if (section === 'pipelines') {
            body = _('Restore default pipelines and selections. Custom pipelines will be removed.');
        } else if (section === 'application-lists') {
            heading = _('Reset application lists?');
            body = _('Restore default lists and remove custom entries.');
        } else if (section === 'applications') {
            body = _('Restore application settings. Application lists will be kept.');
        }
        const dialog = new Adw.AlertDialog({
            heading,
            body,
        });
        dialog.add_response('cancel', _('Cancel'));
        dialog.add_response('reset', _('Reset'));
        dialog.set_response_appearance('reset', Adw.ResponseAppearance.DESTRUCTIVE);
        dialog.set_default_response('cancel');
        dialog.set_close_response('cancel');
        dialog.connect('response', (_dialog, response) => {
            if (response === 'reset')
                this.reset_preferences(section);
        });
        dialog.present(this);
    }
});
