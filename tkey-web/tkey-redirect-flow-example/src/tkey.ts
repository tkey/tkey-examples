import ThresholdKey from "@tkey/default";
import WebStorageModule from "@tkey/web-storage";
import SecurityQuestionsModule from "@tkey/security-questions";
import { TORUS_SAPPHIRE_NETWORK } from "@toruslabs/constants";

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
    web3AuthClientId: "BL9KDlh5mpDm_yJoN1VIpR6ZIUukWN7okEx6hMn8_HEKUPhHyxA-QOdwWqwbBBvMU2cn7A7Ll80WIOguhFqeKNc",
    baseUrl: window.location.origin,
    redirectPathName: "auth",
    enableLogging: true,
    uxMode: "redirect",
    network: TORUS_SAPPHIRE_NETWORK.SAPPHIRE_DEVNET,
  },
});

