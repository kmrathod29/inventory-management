import { normalizeProfileUsername, verifyProfilePassword } from "../profileAuth.js";
import { saveAppConfig } from "../appConfig.js";

export function createAppAuthenticationService(ctx) {
  function verifyApplicationPassword(config, password) {
    if (typeof password !== "string" || password.length > 1024) return false;
    if (typeof config.password === "string") {
      return password === config.password;
    }
    return verifyProfilePassword(config, password);
  }

  function saveAuthentication(appAuthentication) {
    const nextConfig = saveAppConfig(ctx.appConfigPath, {
      ...ctx.appConfig,
      appAuthentication,
    });
    ctx.appConfig = nextConfig;
    return getAuthenticationStatus();
  }

  function getAuthenticationStatus() {
    const config = ctx.appConfig.appAuthentication;
    return {
      isEnabled: Boolean(config),
      username: config?.username ?? "",
    };
  }

  function login(usernameValue, password) {
    const config = ctx.appConfig.appAuthentication;
    const username = typeof usernameValue === "string" ? usernameValue.trim() : "";
    if (
      !config ||
      username.toLocaleLowerCase() !== config.username.toLocaleLowerCase() ||
      !verifyApplicationPassword(config, password)
    ) {
      throw new Error("The username or password is incorrect.");
    }
    if (typeof config.password !== "string") {
      saveAuthentication({ username: config.username, password });
    }
    return getAuthenticationStatus();
  }

  function updateAuthentication(enabled, currentPassword, usernameValue, newPassword) {
    if (typeof enabled !== "boolean") {
      throw new Error("Choose whether application sign-in should be enabled.");
    }
    const currentConfig = ctx.appConfig.appAuthentication;
    if (currentConfig && !verifyApplicationPassword(currentConfig, currentPassword)) {
      throw new Error("The current password is incorrect.");
    }
    if (!enabled) {
      return saveAuthentication(null);
    }

    const username = normalizeProfileUsername(usernameValue);
    if (!currentConfig && (typeof newPassword !== "string" || newPassword.length < 8)) {
      throw new Error("Password must be at least 8 characters.");
    }
    const password = newPassword || currentPassword;
    if (typeof password !== "string" || password.length < 8 || password.length > 1024) {
      throw new Error("Password must be between 8 and 1024 characters.");
    }
    return saveAuthentication({ username, password });
  }

  return { getAuthenticationStatus, login, updateAuthentication };
}
