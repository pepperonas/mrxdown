// Q2: Electron-Fuses — härtet die gepackte Binary (electron-builder afterPack).
// Deaktiviert die Node-Hintertüren des fertigen Builds:
//   - RunAsNode:                    ELECTRON_RUN_AS_NODE=1 macht die App sonst zu einem freien Node-Interpreter
//   - NodeCliInspectArguments:      --inspect öffnet sonst einen Debug-Port mit vollem Zugriff
//   - NodeOptionsEnvironmentVariable: NODE_OPTIONS kann sonst Code injizieren
//   - OnlyLoadAppFromAsar:          verhindert das Unterschieben eines app-Ordners neben dem asar
//   - EnableCookieEncryption:       Session-Daten werden mit OS-Keychain verschlüsselt
// Läuft für alle Plattformen im selben Build-Schritt.
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
const path = require('path');

module.exports = async function afterPack(context) {
    const { electronPlatformName, appOutDir, packager } = context;
    const executableName = electronPlatformName === 'win32'
        ? packager.appInfo.productFilename + '.exe'
        : electronPlatformName === 'darwin'
            ? path.join(packager.appInfo.productFilename + '.app', 'Contents', 'MacOS', packager.appInfo.productFilename)
            : packager.executableName || packager.appInfo.productFilename.toLowerCase();

    const executablePath = path.join(appOutDir, executableName);
    console.log(`[fuses] flipping fuses on ${executablePath}`);

    await flipFuses(executablePath, {
        version: FuseVersion.V1,
        resetAdHocDarwinSignature: electronPlatformName === 'darwin',
        [FuseV1Options.RunAsNode]: false,
        [FuseV1Options.EnableNodeCliInspectArguments]: false,
        [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
        [FuseV1Options.OnlyLoadAppFromAsar]: true,
        [FuseV1Options.EnableCookieEncryption]: true
    });
    console.log('[fuses] done');
};
