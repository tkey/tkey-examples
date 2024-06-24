import ThresholdKey from "@tkey/core";
import { SfaServiceProvider } from "@tkey/service-provider-sfa";
import { Web3AuthOptions } from "@tkey/service-provider-sfa/dist/types/interfaces";
import TorusStorageLayer from "@tkey/storage-layer-torus";
import WebStorageModule from "@tkey/web-storage";
import { TORUS_SAPPHIRE_NETWORK } from "@toruslabs/constants";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";

// Configuration of Modules
const webStorageModule = new WebStorageModule();
const web3AuthOptions: Web3AuthOptions = {
  clientId: "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ",
  network: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
};

const serviceProvider = new SfaServiceProvider({ web3AuthOptions })

// Instantiation of Storage Layer
const storageLayer = new TorusStorageLayer({
  hostUrl: 'https://metadata.tor.us',
});

export const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.SOLANA,
  chainId: "0x3", // Please use 0x1 for Mainnet, 0x2 for Testnet, 0x3 for Devnet
  rpcTarget: "https://api.devnet.solana.com",
  displayName: "Solana Devnet",
  blockExplorer: "https://explorer.solana.com",
  ticker: "SOL",
  tickerName: "Solana",
};

// Instantiation of tKey
export const tKey = new ThresholdKey({
  serviceProvider,
  storageLayer: storageLayer,
  modules: {
    webStorage: webStorageModule,
  },
});

