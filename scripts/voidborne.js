// Import generic features from the library file
import * as VoidFeatures from './features.js';

const MODULE_ID = 'daggerheart-voidborne-ru';

console.log(`${MODULE_ID} | Module JS Loaded`);

Hooks.once('init', () => {
    console.log(`${MODULE_ID} | Initializing The Void (Unofficial)`);

    // Expose the Void features globally
    // This allows Void.ComboStrikes(), Void.NewFunction(), etc.
    window.Void = window.Void || {};

    // Assign all exported functions from features.js to window.Void
    Object.assign(window.Void, VoidFeatures);

    console.log(`${MODULE_ID} | Void features registered:`, Object.keys(VoidFeatures));
});

Hooks.on('ready', async () => {
    // Only run if the system is Daggerheart
    if (game.system.id !== 'daggerheart') return;

    // Register Blood and Dread domains in system settings
    await registerVoidDomains();
});

async function registerVoidDomains() {
    // Access Daggerheart Homebrew Settings
    // The system stores homebrew config in a setting named 'Homebrew' (case sensitive check needed)

    // Check if the setting exists
    let homebrewSettings;
    try {
        homebrewSettings = game.settings.get('daggerheart', 'Homebrew');
    } catch (e) {
        try {
            homebrewSettings = game.settings.get('daggerheart', 'homebrew');
        } catch (e2) {
            console.warn(`${MODULE_ID} | Could not find Daggerheart 'Homebrew' or 'homebrew' setting.`);
            return;
        }
    }

    if (!homebrewSettings) return;

    const domainData = {
        'blood': {
            id: 'blood',
            label: 'Кровь',
            src: `modules/${MODULE_ID}/icons/svg/blood.svg`,
            description: 'Домен Крови.'
        },
        'dread': {
            id: 'dread',
            label: 'Ужас',
            src: `modules/${MODULE_ID}/icons/svg/dread.svg`,
            description: 'Домен Ужаса.'
        }
    };

    let updates = false;
    // user domains are in homebrewSettings.domains
    const currentDomains = { ...(homebrewSettings.domains || {}) };

    for (const [key, data] of Object.entries(domainData)) {
        if (!currentDomains[key]) {
            console.log(`${MODULE_ID} | Registering missing domain: ${data.label}`);
            currentDomains[key] = data;
            updates = true;
        }
    }

    if (updates) {
        // Update the setting
        try {
            // We need to keep the structure of homebrewSettings intact
            const newSettings = {
                ...homebrewSettings,
                domains: currentDomains
            };

            // We need to know the Key used to set it.
            let key = 'Homebrew';
            if (game.settings.settings.has('daggerheart.homebrew')) key = 'homebrew';

            await game.settings.set('daggerheart', key, newSettings);

            ui.notifications.info(`${MODULE_ID} | Домены Крови и Ужаса добавлены в настройки.`);
        } catch (err) {
            console.error(`${MODULE_ID} | Failed to update settings:`, err);
        }
    }
}
