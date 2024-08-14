import { useState } from "react";
import { tKey, chainConfig } from './tkey';
import { ShareSerializationModule } from '@tkey/share-serialization';
import { SfaServiceProvider } from '@tkey/service-provider-sfa';
import { WebStorageModule } from '@tkey/web-storage';


// Firebase libraries for custom authentication
import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithPopup, UserCredential } from "firebase/auth";

import "./App.css";
import { SolanaPrivateKeyProvider } from "@web3auth/solana-provider";
import { hex } from "@scure/base";
import { Keypair } from "@solana/web3.js";
import SolanaRPC from "./SolanaRPC";

const verifier = "w3a-firebase-demo";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB0nd9YsPLu-tpdCrsXn8wgsWVAiYEpQ_E",
  authDomain: "web3auth-oauth-logins.firebaseapp.com",
  projectId: "web3auth-oauth-logins",
  storageBucket: "web3auth-oauth-logins.appspot.com",
  messagingSenderId: "461819774167",
  appId: "1:461819774167:web:e74addfb6cc88f3b5b9c92",
};

function App() {
  const [tKeyInitialised, setTKeyInitialised] = useState(false);
  const [solanaRpc, setSolanaRPC] = useState<SolanaRPC | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState({});
  const [recoveryShare, setRecoveryShare] = useState<string>("");
  const [mnemonicShare, setMnemonicShare] = useState<string>("");

  // Firebase Initialisation
  const app = initializeApp(firebaseConfig);

  const solanaPrivateKeyProvider = new SolanaPrivateKeyProvider({
    config: {
      chainConfig,
    },
  });


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

  const parseToken = (token: string) => {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace("-", "+").replace("_", "/");
      return JSON.parse(window.atob(base64 || ""));
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const login = async () => {
    try {
      // Login with firebase
      const loginRes = await signInWithGoogle();
      // Get the id token from firebase
      const idToken = await loginRes.user.getIdToken(true);
      const userInfo = parseToken(idToken);
      setUserInfo(userInfo);

      await (
        tKey.serviceProvider as SfaServiceProvider
      ).connect({
        verifier,
        verifierId: userInfo.sub,
        idToken,
      });

      const seed = Buffer.from(hex.decode("e5aa968ef904bb48f6230ac345463d094dfdcd5c0ee94aae31558dbb33d80e58"));
      console.log(seed);

      // Uncomment to test importEd25519Seed
      await tKey.initialize(
        // {
        //   importEd25519Seed: seed
        // }
      );

      setTKeyInitialised(true);

      var { requiredShares } = tKey.getKeyDetails();

      if (requiredShares > 0) {
        uiConsole('Please enter your backup shares, requiredShares:', requiredShares);
      } else {
        await reconstructKey();
      }
    }
    catch (err) {
      uiConsole(err);
    }
  };

  const reconstructKey = async () => {
    try {
      await tKey.reconstructKey();
      const seed = await tKey.retrieveEd25519Seed();
      const keyPair = Keypair.fromSeed(seed);

      solanaPrivateKeyProvider.setupProvider(hex.encode(keyPair.secretKey));
      const solanaRPC = new SolanaRPC(solanaPrivateKeyProvider);

      setSolanaRPC(solanaRPC);
      await setDeviceShare();
      setLoggedIn(true);
    } catch (e) {
      uiConsole(e);
    }
  };

  const inputRecoveryShare = async (share: string) => {
    try {
      await tKey.inputShare(share);
      await reconstructKey();
      uiConsole('Recovery Share Input Successfully');
      return;
    } catch (error) {
      uiConsole('Input Recovery Share Error:', error);
    }
  };

  const keyDetails = async () => {
    if (!tKey) {
      uiConsole("tKey not initialized yet");
      return;
    }
    const keyDetails = await tKey.getKeyDetails();
    uiConsole(keyDetails);
  };

  const setDeviceShare = async () => {
    try {
      const generateShareResult = await tKey.generateNewShare();
      const share = await tKey.outputShareStore(
        generateShareResult.newShareIndex,
      );
      await (
        tKey.modules.webStorage as WebStorageModule
      ).storeDeviceShare(share);
      uiConsole('Device Share Set', JSON.stringify(share));
    } catch (error) {
      uiConsole('Error', (error as any)?.message.toString(), 'error');
    }
  };

  const getDeviceShare = async () => {
    try {
      const share = await (
        tKey.modules.webStorage as WebStorageModule
      ).getDeviceShare();

      if (share) {
        uiConsole(
          'Device Share Captured Successfully across',
          JSON.stringify(share),
        );
        setRecoveryShare(share.share.share.toString('hex'));
        return share;
      }
      uiConsole('Device Share Not found');
      return null;
    } catch (error) {
      uiConsole('Error', (error as any)?.message.toString(), 'error');
    }
  };

  const exportMnemonicShare = async () => {
    try {
      const generateShareResult = await tKey.generateNewShare();
      const share = await tKey.outputShareStore(
        generateShareResult.newShareIndex,
      ).share.share;
      const mnemonic = await (
        tKey.modules.shareSerialization as ShareSerializationModule
      ).serialize(share, 'mnemonic');
      uiConsole(mnemonic);
      return mnemonic;
    } catch (error) {
      uiConsole(error);
    }
  };

  const MnemonicToShareHex = async (mnemonic: string) => {
    if (!tKey) {
      uiConsole('tKey not initialized yet');
      return;
    }
    try {
      const share = await (
        tKey.modules.shareSerialization as ShareSerializationModule
      ).deserialize(mnemonic, 'mnemonic');
      setRecoveryShare(share.toString("hex"));
      return share;
    } catch (error) {
      uiConsole(error);
    }
  };

  const getUserInfo = async () => {
    uiConsole(userInfo);
  };

  const logout = async () => {
    setSolanaRPC(null);
    setLoggedIn(false);
    setUserInfo({});
    uiConsole("logged out");
  };

  const getAccounts = async () => {
    if (!solanaRpc) {
      uiConsole("Wallet not initialized yet");
      return;
    }

    const address = await solanaRpc.getAccount();
    uiConsole(address);
  };

  const getBalance = async () => {
    if (!solanaRpc) {
      uiConsole("Wallet not initialized yet");
      return;
    }

    const balance = await solanaRpc.getBalance();
    uiConsole(balance);
  };

  const signMessage = async () => {
    if (!solanaRpc) {
      uiConsole("Wallet not initialized yet");
      return;
    }

    const signedMessage = await solanaRpc.signMessage();
    uiConsole(signedMessage);
  };

  const requestFaucet = async () => {
    if (!solanaRpc) {
      uiConsole("Wallet not initialized yet");
      return;
    }

    try {
      const signedMessage = await solanaRpc.requestFaucet();
      uiConsole(signedMessage);
    } catch (e) {
      uiConsole(e?.toString());
    }
  };

  const sendTransaction = async () => {
    if (!solanaRpc) {
      uiConsole("Wallet not initialized yet");
      return;
    }

    try {
      const signedMessage = await solanaRpc.sendTransaction();
      uiConsole(signedMessage);
    } catch (e) {
      uiConsole(e);
    }
  };

  const criticalResetAccount = async (): Promise<void> => {
    // This is a critical function that should only be used for testing purposes
    // Resetting your account means clearing all the metadata associated with it from the metadata server
    // The key details will be deleted from our server and you will not be able to recover your account
    if (!tKeyInitialised) {
      throw new Error("tKeyInitialised is initialised yet");
    }
    await tKey.storageLayer.setMetadata({
      privKey: tKey.serviceProvider.postboxKey,
      input: { message: "KEY_NOT_FOUND" },
    });
    uiConsole('reset');
    logout();
  }


  function uiConsole(...args: any[]): void {
    const el = document.querySelector("#console>p");
    if (el) {
      el.innerHTML = JSON.stringify(args || {}, null, 2);
    }
    console.log(...args);
  }

  const loggedInView = (
    <>
      <div className="flex-container">
        <div>
          <button onClick={getUserInfo} className="card">
            Get User Info
          </button>
        </div>
        <div>
          <button onClick={keyDetails} className='card'>
            Key Details
          </button>
        </div>
        <div>
          <button onClick={exportMnemonicShare} className='card'>
            Generate Backup (Mnemonic)
          </button>
        </div>
        <div>
          <button onClick={getAccounts} className="card">
            Get Accounts
          </button>
        </div>
        <div>
          <button onClick={getBalance} className="card">
            Get Balance
          </button>
        </div>
        <div>
          <button onClick={requestFaucet} className="card">
            Request Facuet
          </button>
        </div>
        <div>
          <button onClick={signMessage} className="card">
            Sign Message
          </button>
        </div>
        <div>
          <button onClick={sendTransaction} className="card">
            Send Transaction
          </button>
        </div>
        <div>
          <button onClick={logout} className="card">
            Log Out
          </button>
        </div>
        <div>
          <button onClick={criticalResetAccount} className="card">
            [CRITICAL] Reset Account
          </button>
        </div>
      </div>
    </>
  );

  const unloggedInView = (
    <>
      <button onClick={login} className="card">
        Login
      </button>
      <div className={tKeyInitialised ? "" : "disabledDiv"} >

        <button onClick={() => getDeviceShare()} className="card">
          Get Device Share
        </button>
        <label>Backup/ Device Share:</label>
        <input value={recoveryShare} onChange={(e) => setRecoveryShare(e.target.value)}></input>
        <button onClick={() => inputRecoveryShare(recoveryShare)} className="card">
          Input Recovery Share
        </button>
        <button onClick={criticalResetAccount} className="card">
          [CRITICAL] Reset Account
        </button>
        <label>Recover Using Mnemonic Share:</label>
        <input value={mnemonicShare} onChange={(e) => setMnemonicShare(e.target.value)}></input>
        <button onClick={() => MnemonicToShareHex(mnemonicShare)} className="card">
          Get Recovery Share using Mnemonic
        </button>
      </div>
    </>
  );

  return (
    <div className="container">
      <h1 className="title">
        <a target="_blank" href="https://web3auth.io/docs/sdk/core-kit/tkey" rel="noreferrer">
          Web3Auth tKey
        </a>{" "}
        Solana Quick Start
      </h1>

      <div className="grid">{loggedIn ? loggedInView : unloggedInView}</div>
      <div id="console" style={{ whiteSpace: "pre-line" }}>
        <p style={{ whiteSpace: "pre-line" }}></p>
      </div>

      <footer className="footer">
        <a
          href="https://github.com/Web3Auth/web3auth-core-kit-examples/tree/main/tkey-web/quick-starts/tkey-solana-example"
          target="_blank"
          rel="noopener noreferrer"
        >
          Source code
        </a>
      </footer>
    </div>
  );
}

export default App;