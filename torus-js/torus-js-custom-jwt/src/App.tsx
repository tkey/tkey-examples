/* eslint-disable @typescript-eslint/no-use-before-define */
import "./App.css";

import { Keypair } from "@solana/web3.js";
import { NodeDetailManager } from "@toruslabs/fetch-node-details";
import { Torus, TorusKey } from "@toruslabs/torus.js";
import { sign } from "@tsndr/cloudflare-worker-jwt";

const clientId = "BFuUqebV5I8Pz5F7a5A2ihW7YVmbv_OHXnHYDv6OltAD5NGr6e-ViNvde3U4BHdn6HvwfkgobhVu4VwC-OSJkik"; // get from https://dashboard.web3auth.io

const verifier = "torus-custom-jwt";

const secret = import.meta.env.VITE_SECRET;

function App() {
  const loginEth = async () => {
    const nodeDetailManagerInstance = new NodeDetailManager({
      network: "sapphire_devnet",
    });
    const jwtToken = await sign(
      {
        name: "Agrawal Alam Mishra Bherwani",
        email: "devrel@web3auth.io",
        sub: "oYhOJ9puDqLK+btQ7SDgCiflwT3Bg8H/OMvlXAesCzc=",
        aud: "urn:api-web3auth-io",
        iss: "https://web3auth.io",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
      },
      secret,
      {
        algorithm: "RS256",
        header: {
          kid: "a9e197d461ccd5aba0831b7f33f",
        },
      }
    );
    uiConsole(jwtToken);

    const torusInstance = new Torus({
      clientId,
      enableOneKey: true,
      network: "sapphire_devnet",
    });

    const verifierDetails = { verifier, verifierId: "oYhOJ9puDqLK+btQ7SDgCiflwT3Bg8H/OMvlXAesCzc=" };

    const { torusNodeEndpoints, torusIndexes, torusNodePub } = await nodeDetailManagerInstance.getNodeDetails(verifierDetails);

    const torusKey: TorusKey = await torusInstance.retrieveShares({
      endpoints: torusNodeEndpoints,
      indexes: torusIndexes,
      verifier,
      verifierParams: { verifier_id: "oYhOJ9puDqLK+btQ7SDgCiflwT3Bg8H/OMvlXAesCzc=" },
      idToken: jwtToken,
      nodePubkeys: torusNodePub,
    });

    const { privKey } = torusKey.finalKeyData;

    uiConsole(privKey);
  };

  const loginSolana = async () => {
    const nodeDetailManagerInstance = new NodeDetailManager({
      network: "sapphire_devnet",
    });

    const torusInstance = new Torus({
      clientId,
      enableOneKey: true,
      network: "sapphire_devnet",
      keyType: "ed25519",
    });
    const jwtToken = await sign(
      {
        name: "Agrawal Alam Mishra Bherwani",
        email: "devrel@web3auth.io",
        sub: "oYhOJ9puDqLK+btQ7SDgCiflwT3Bg8H/OMvlXAesCzc=",
        aud: "urn:api-web3auth-io",
        iss: "https://web3auth.io",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
      },
      secret,
      {
        algorithm: "RS256",
        header: {
          kid: "a9e197d461ccd5aba0831b7f33f",
        },
      }
    );
    uiConsole(jwtToken);

    const verifierDetails = { verifier, verifierId: "oYhOJ9puDqLK+btQ7SDgCiflwT3Bg8H/OMvlXAesCzc=" };

    const { torusNodeEndpoints, torusIndexes, torusNodePub } = await nodeDetailManagerInstance.getNodeDetails(verifierDetails);

    const torusKey: TorusKey = await torusInstance.retrieveShares({
      endpoints: torusNodeEndpoints,
      indexes: torusIndexes,
      verifier,
      verifierParams: { verifier_id: "oYhOJ9puDqLK+btQ7SDgCiflwT3Bg8H/OMvlXAesCzc=" },
      idToken: jwtToken,
      nodePubkeys: torusNodePub,
    });

    uiConsole(torusKey);

    const seedHex = torusKey.finalKeyData.privKey;
    if (!seedHex) {
      throw new Error("No private key found");
    }
    const seed = Buffer.from(seedHex, "hex");

    const keyPair = Keypair.fromSeed(new Uint8Array(seed));

    const privateKey = Buffer.from(keyPair.secretKey).toString("hex");
    const { publicKey } = keyPair;

    const result = {
      "Expanded Private Key (64 bytes):": privateKey,
      "Public Key X:": torusKey.finalKeyData.X,
      "Public Key Y:": torusKey.finalKeyData.Y,
      "Public Key (32 bytes):": publicKey.toBuffer().toString("hex"),
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
        & React Custom JWT Demo
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
