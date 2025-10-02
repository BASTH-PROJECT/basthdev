const { withAndroidManifest, withStringsXml, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to add Android App Shortcuts
 * Adds shortcuts.xml and modifies AndroidManifest.xml automatically
 */
function withAndroidShortcuts(config) {
  // Step 1: Add shortcuts.xml file
  config = withShortcutsXml(config);

  // Step 2: Add string resources
  config = withStringsXml(config, (config) => {
    const strings = config.modResults;
    
    // Check if strings already exist to avoid duplicates
    const existingStrings = strings.resources.string.map(s => s.$.name);
    
    const shortcutStrings = [
      { name: 'shortcut_expense_short', value: 'Pengeluaran' },
      { name: 'shortcut_expense_long', value: 'Tambah Pengeluaran' },
      { name: 'shortcut_income_short', value: 'Pemasukan' },
      { name: 'shortcut_income_long', value: 'Tambah Pemasukan' },
    ];

    shortcutStrings.forEach(({ name, value }) => {
      if (!existingStrings.includes(name)) {
        strings.resources.string.push({
          $: { name },
          _: value,
        });
      }
    });

    return config;
  });

  // Step 3: Modify AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];
    
    // Find MainActivity
    const mainActivity = mainApplication.activity?.find(
      (activity) => activity.$['android:name'] === '.MainActivity'
    );

    if (mainActivity) {
      // Ensure launchMode is singleTask to handle intents correctly
      mainActivity.$['android:launchMode'] = 'singleTask';

      // Add shortcuts meta-data
      if (!mainActivity['meta-data']) {
        mainActivity['meta-data'] = [];
      }

      // Check if shortcuts meta-data already exists
      const hasShortcutsMeta = mainActivity['meta-data'].some(
        (meta) => meta.$['android:name'] === 'android.app.shortcuts'
      );

      if (!hasShortcutsMeta) {
        mainActivity['meta-data'].push({
          $: {
            'android:name': 'android.app.shortcuts',
            'android:resource': '@xml/shortcuts',
          },
        });
      }

      // Add deep link intent filter
      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }

      // Check if deep link intent filter already exists
      const hasDeepLinkFilter = mainActivity['intent-filter'].some((filter) => {
        return filter.data?.some((data) => data.$['android:scheme'] === 'onicashapp');
      });

      if (!hasDeepLinkFilter) {
        mainActivity['intent-filter'].push({
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
            { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
          ],
          data: [{ $: { 'android:scheme': 'onicashapp' } }],
        });
      }
    }

    return config;
  });

  return config;
}

/**
 * Add shortcuts.xml to android/app/src/main/res/xml/
 */
function withShortcutsXml(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const xmlDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'res',
        'xml'
      );

      // Create xml directory if it doesn't exist
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }

      const shortcutsXmlPath = path.join(xmlDir, 'shortcuts.xml');

      // Get package name from config
      const packageName = config.android?.package || 'com.onicashapp';

      const shortcutsXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Add Expense Shortcut -->
    <shortcut
        android:shortcutId="add_expense"
        android:enabled="true"
        android:icon="@mipmap/ic_launcher"
        android:shortcutShortLabel="@string/shortcut_expense_short"
        android:shortcutLongLabel="@string/shortcut_expense_long">
        <intent
            android:action="android.intent.action.VIEW"
            android:targetPackage="${packageName}"
            android:targetClass="${packageName}.MainActivity"
            android:data="onicashapp://(protected)?type=expense" />
        <categories android:name="android.shortcut.conversation" />
    </shortcut>

    <!-- Add Income Shortcut -->
    <shortcut
        android:shortcutId="add_income"
        android:enabled="true"
        android:icon="@mipmap/ic_launcher"
        android:shortcutShortLabel="@string/shortcut_income_short"
        android:shortcutLongLabel="@string/shortcut_income_long">
        <intent
            android:action="android.intent.action.VIEW"
            android:targetPackage="${packageName}"
            android:targetClass="${packageName}.MainActivity"
            android:data="onicashapp://(protected)?type=income" />
        <categories android:name="android.shortcut.conversation" />
    </shortcut>
</shortcuts>`;

      fs.writeFileSync(shortcutsXmlPath, shortcutsXmlContent, 'utf-8');

      return config;
    },
  ]);
}

module.exports = withAndroidShortcuts;
