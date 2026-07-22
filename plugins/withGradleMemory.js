const { withGradleProperties } = require('@expo/config-plugins');

// Post-SDK-57-upgrade Gradle builds (newer AGP/D8/Kotlin toolchain) OOM'd
// during dexing with the template default (-Xmx2048m, 512m Metaspace) —
// "OutOfMemoryError: Metaspace" in :app:mergeExtDexRelease. Bumping both
// here so it survives `expo prebuild --clean` regenerating android/gradle.properties
// from scratch, same reasoning as withReleaseSigning.js.
module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, config => {
    const key = 'org.gradle.jvmargs';
    const value = '-Xmx4096m -XX:MaxMetaspaceSize=1024m';
    const existing = config.modResults.find(item => item.type === 'property' && item.key === key);
    if (existing) {
      existing.value = value;
    } else {
      config.modResults.push({ type: 'property', key, value });
    }
    return config;
  });
};
