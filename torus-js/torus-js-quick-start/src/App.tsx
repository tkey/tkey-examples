/* eslint-disable @typescript-eslint/no-use-before-define */
import "./App.css";

import { Keypair } from "@solana/web3.js";
import { NodeDetailManager } from "@toruslabs/fetch-node-details";
// IMP START - Quick Start
import { Torus, TorusKey } from "@toruslabs/torus.js";
import base64urlLib from "base64url";
// IMP END - Quick Start
// Firebase libraries for custom authentication
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, UserCredential } from "firebase/auth";

// IMP START - Dashboard Registration
const clientId = "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ"; // get from https://dashboard.web3auth.io
// IMP END - Dashboard Registration

// IMP START - Verifier Creation
const verifier = "w3a-firebase-demo";
// IMP END - Verifier Creation

// IMP START - Auth Provider Login
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB0nd9YsPLu-tpdCrsXn8wgsWVAiYEpQ_E",
  authDomain: "web3auth-oauth-logins.firebaseapp.com",
  projectId: "web3auth-oauth-logins",
  storageBucket: "web3auth-oauth-logins.appspot.com",
  messagingSenderId: "461819774167",
  appId: "1:461819774167:web:e74addfb6cc88f3b5b9c92",
};
// IMP END - Auth Provider Login

const base64url = base64urlLib;

function App() {
  // Firebase Initialisation
  const app = initializeApp(firebaseConfig);

  const decodeToken = (token: string): any => {
    const [header, payload] = token.split(".");
    return {
      header: JSON.parse(base64url.decode(header)),
      payload: JSON.parse(base64url.decode(payload)),
    };
  };

  // IMP START - Auth Provider Login
  const signInWithGoogle = async (): Promise<UserCredential> => {
    try {
      const auth = getAuth(app);
      const googleProvider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, googleProvider);
      console.log(res);
      return res;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };
  // IMP END - Auth Provider Login

  const loginEth = async () => {
    const nodeDetailManagerInstance = new NodeDetailManager({
      network: "sapphire_mainnet",
    });

    const torusInstance = new Torus({
      clientId,
      enableOneKey: true,
      network: "sapphire_mainnet",
    });
    // IMP START - Auth Provider Login
    // login with firebase
    const loginRes = await signInWithGoogle();
    // get the id token from firebase
    const idToken = await loginRes.user.getIdToken(true);
    const { payload } = decodeToken(idToken);
    // IMP END - Auth Provider Login

    const verifierDetails = { verifier, verifierId: (payload as any).sub };

    const { torusNodeEndpoints, torusIndexes, torusNodePub } = await nodeDetailManagerInstance.getNodeDetails(verifierDetails);

    const torusKey: TorusKey = await torusInstance.retrieveShares({
      endpoints: torusNodeEndpoints,
      indexes: torusIndexes,
      verifier,
      verifierParams: { verifier_id: (payload as any).sub },
      idToken,
      nodePubkeys: torusNodePub,
      useDkg: true,
    });

    const { privKey } = torusKey.finalKeyData;

    uiConsole(privKey);
  };

  const loginSolana = async () => {
    const nodeDetailManagerInstance = new NodeDetailManager({
      network: "sapphire_mainnet",
    });

    const torusInstance = new Torus({
      clientId,
      enableOneKey: true,
      network: "sapphire_mainnet",
      keyType: "ed25519",
    });
    // IMP START - Auth Provider Login
    // login with firebase
    const loginRes = await signInWithGoogle();
    // get the id token from firebase
    const idToken = await loginRes.user.getIdToken(true);
    const { payload } = decodeToken(idToken);
    // IMP END - Auth Provider Login

    const verifierDetails = { verifier, verifierId: (payload as any).sub };

    const { torusNodeEndpoints, torusIndexes, torusNodePub } = await nodeDetailManagerInstance.getNodeDetails(verifierDetails);

    const torusKey: TorusKey = await torusInstance.retrieveShares({
      endpoints: torusNodeEndpoints,
      indexes: torusIndexes,
      verifier,
      verifierParams: { verifier_id: (payload as any).sub },
      idToken,
      nodePubkeys: torusNodePub,
      useDkg: true,
    });

    uiConsole(torusKey);

    const seedHex = torusKey.finalKeyData.privKey;
    if (!seedHex) {
      throw new Error("No private key found");
    }
    const seed = Buffer.from(seedHex, "hex");

    const keyPair = Keypair.fromSeed(seed);

    const privateKey = Buffer.from(keyPair.secretKey).toString("hex");
    const { publicKey } = keyPair;

    const result = {
      "Expanded Private Key (64 bytes):": privateKey,
      "Public Key X:": torusKey.finalKeyData.X,
      "Public Key Y:": torusKey.finalKeyData.Y,
      "Public Key (32 bytes):": publicKey,
      "Address from Public Key:": publicKey.toBase58(),
      "Address from Web3Auth:": torusKey.finalKeyData.walletAddress,
    };
    uiConsole(result);
  };

  function uiConsole(...args: any[]): void {
    const el = document.querySelector("#console>p");
    if (el) {
      el.innerHTML = JSON.stringify(args || {}, null, 2);
    }
    console.log(...args);
  }

  return (
    <div className="container">
      <h1 className="title">
        <a target="_blank" href="https://web3auth.io/docs/sdk/core-kit/sfa-web" rel="noreferrer">
          Torus.js
        </a>{" "}
        & React Quick Start
      </h1>

      <div className="grid">
        <button onClick={loginEth} className="card">
          Login & Get Ethereum Key
        </button>
        <button onClick={loginSolana} className="card">
          Login & Get Solana Key
        </button>
      </div>
      <div id="console" style={{ whiteSpace: "pre-line" }}>
        <p style={{ whiteSpace: "pre-line" }}></p>
      </div>
    </div>
  );
}

export default App;
