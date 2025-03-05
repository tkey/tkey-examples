import ThresholdKey from "@tkey/default";
import WebStorageModule from "@tkey/web-storage";
import SecurityQuestionsModule from "@tkey/security-questions";
import { TORUS_SAPPHIRE_NETWORK } from "@toruslabs/constants";

// Configuration of Service Provider
// Configuration of Modules
const webStorageModule = new WebStorageModule();
const securityQuestionsModule = new SecurityQuestionsModule();

// Instantiation of tKey
export const tKey = new ThresholdKey({
  modules: {
    webStorage: webStorageModule,
    securityQuestions: securityQuestionsModule,
  },
  customAuthArgs: {
    web3AuthClientId: "BIXMFlyinF9KZs8Wk-ax8WV8oztnMhaOASxCON4ozfIVU1cqdOUmF2ZCCr71HkHHQKeycKUTPMV1wlPZ3yyl6Rc",
    baseUrl: `${window.location.origin}/serviceworker`,
    network: TORUS_SAPPHIRE_NETWORK.SAPPHIRE_DEVNET,
  },
});