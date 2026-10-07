const {
  withXcodeProject,
  withEntitlementsPlist,
  withInfoPlist,
  IOSConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const APP_GROUP = 'group.com.kairos.mobile';
const EXTENSIONS = [
  {
    name: 'KairosShare',
    folder: 'ShareExtension',
    bundleId: 'com.kairos.mobile.share',
    productType: 'com.apple.product-type.app-extension',
  },
  {
    name: 'KairosKeyboard',
    folder: 'KeyboardExtension',
    bundleId: 'com.kairos.mobile.keyboard',
    productType: 'com.apple.product-type.app-extension',
  },
  {
    name: 'KairosWidget',
    folder: 'WidgetExtension',
    bundleId: 'com.kairos.mobile.widget',
    productType: 'com.apple.product-type.app-extension',
  },
];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function sourceRoot() {
  return path.join(
    __dirname,
    '..',
    'modules',
    'kairos-os',
    'ios-extensions',
  );
}

const withKairosOs = (config) => {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.NSMicrophoneUsageDescription =
      mod.modResults.NSMicrophoneUsageDescription ||
      'Kairos records audio only when you start voice capture.';
    return mod;
  });

  config = withEntitlementsPlist(config, (mod) => {
    const groups = mod.modResults['com.apple.security.application-groups'] || [];
    if (!groups.includes(APP_GROUP)) groups.push(APP_GROUP);
    mod.modResults['com.apple.security.application-groups'] = groups;
    return mod;
  });

  config = withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName
      ? IOSConfig.XcodeUtils.getProjectName(mod.modRequest.projectRoot)
      : 'kairos';
    const iosRoot = path.join(mod.modRequest.projectRoot, 'ios');
    const sharedSrc = path.join(sourceRoot(), 'Shared');

    for (const ext of EXTENSIONS) {
      const dest = path.join(iosRoot, ext.name);
      copyDir(path.join(sourceRoot(), ext.folder), dest);
      if (fs.existsSync(sharedSrc)) {
        copyDir(sharedSrc, path.join(dest, 'Shared'));
      }

      if (project.pbxTargetByName(ext.name)) {
        continue;
      }

      const target = project.addTarget(
        ext.name,
        'app_extension',
        ext.name,
        ext.bundleId,
      );
      const group = project.addPbxGroup(
        fs.readdirSync(dest).filter((name) => !name.startsWith('.')),
        ext.name,
        ext.name,
      );
      const mainGroup = project.getFirstProject().firstProject.mainGroup;
      project.addToPbxGroup(group.uuid, mainGroup);

      if (target) {
        project.addBuildPhase(
          [],
          'PBXSourcesBuildPhase',
          'Sources',
          target.uuid,
        );
        project.addBuildPhase(
          [],
          'PBXFrameworksBuildPhase',
          'Frameworks',
          target.uuid,
        );
        project.addBuildPhase(
          [],
          'PBXResourcesBuildPhase',
          'Resources',
          target.uuid,
        );
      }
    }

    void projectName;
    return mod;
  });

  return config;
};

module.exports = withKairosOs;
